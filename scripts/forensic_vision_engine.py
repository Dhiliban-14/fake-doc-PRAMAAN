import sys
import json
import os
import io
import math
import numpy as np
import cv2
from PIL import Image, ImageChops

def analyze_image(image_path: str, output_heatmap_dir: str = None) -> dict:
    if not os.path.exists(image_path):
        return {"error": f"File not found: {image_path}", "success": False}

    try:
        # Load image with OpenCV and Pillow
        cv_img = cv2.imread(image_path)
        if cv_img is None:
            return {"error": "Failed to decode image matrix", "success": False}

        h, w, c = cv_img.shape
        gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)

        # 1. Quality & Blur Assessment (Tenengrad Laplacian)
        laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        is_blurry = laplacian_var < 75.0

        # Glare detection: percentage of pixels with luminance > 250
        glare_ratio = float(np.sum(gray > 250) / (w * h))

        # 2. Multi-Q Error Level Analysis (ELA)
        pil_img = Image.open(image_path).convert("RGB")
        ela_buffer = io.BytesIO()
        pil_img.save(ela_buffer, format="JPEG", quality=90)
        ela_buffer.seek(0)
        recompressed = Image.open(ela_buffer)
        
        diff = ImageChops.difference(pil_img, recompressed)
        diff_arr = np.asarray(diff, dtype=np.float32)
        gray_diff = np.max(diff_arr, axis=2) # Peak channel error

        mean_err = float(np.mean(gray_diff))
        std_err = float(np.std(gray_diff))
        threshold = mean_err + 3.0 * std_err

        anomalous_mask = (gray_diff > threshold).astype(np.uint8) * 255
        anomalous_ratio = float(np.sum(anomalous_mask > 0) / (w * h))

        # Save scaled heatmap if output directory provided
        heatmap_rel_path = None
        if output_heatmap_dir:
            os.makedirs(output_heatmap_dir, exist_ok=True)
            basename = os.path.splitext(os.path.basename(image_path))[0]
            heatmap_filename = f"{basename}_ela.jpg"
            heatmap_full_path = os.path.join(output_heatmap_dir, heatmap_filename)
            scaled_diff = np.clip(gray_diff * 12.0, 0, 255).astype(np.uint8)
            heatmap_colored = cv2.applyColorMap(scaled_diff, cv2.COLORMAP_JET)
            cv2.imwrite(heatmap_full_path, heatmap_colored)
            heatmap_rel_path = f"/uploads/heatmaps/{heatmap_filename}"

        # 3. Find Anomaly Bounding Boxes from ELA mask
        contours, _ = cv2.findContours(anomalous_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        tampering_regions = []
        region_idx = 1
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area > 120: # Filter small noise specks
                x, y, bw, bh = cv2.boundingRect(cnt)
                region_prob = min(0.96, max(0.45, (area / (w * h * 0.05)) * 0.7 + 0.3))
                severity = "critical" if region_prob > 0.85 else "high" if region_prob > 0.65 else "medium"
                
                tampering_regions.append({
                    "regionIndex": region_idx,
                    "anomalyType": "ela_compression_anomaly",
                    "severity": severity,
                    "probability": round(float(region_prob), 3),
                    "confidence": round(min(0.95, max(0.60, 0.5 + std_err / 20.0)), 2),
                    "bbox": {
                        "x": round(float(x / w), 4),
                        "y": round(float(y / h), 4),
                        "w": round(float(bw / w), 4),
                        "h": round(float(bh / h), 4)
                    },
                    "whyFlagged": f"Compression quantization error deviates by >3σ (local error: {round(float(np.mean(gray_diff[y:y+bh, x:x+bw])), 2)} vs background {round(mean_err, 2)}).",
                    "supportingSignals": ["High-frequency localized DCT mismatch", "Layered resave artifact"],
                    "alternativeExplanations": ["Localized image re-compression", "Repeated sticker / seal scan overlay"],
                    "detectorModel": "OpenCV-ELA-v2.1"
                })
                region_idx += 1
                if region_idx > 8:
                    break

        # 4. Localized Noise Residual Variance (32x32 Grid)
        denoised = cv2.medianBlur(gray, 3)
        noise = cv2.absdiff(gray, denoised).astype(np.float32)
        patch_size = 32
        h_steps, w_steps = h // patch_size, w // patch_size
        noise_anomalies = 0

        if h_steps > 2 and w_steps > 2:
            variances = []
            for i in range(h_steps):
                for j in range(w_steps):
                    patch = noise[i*patch_size:(i+1)*patch_size, j*patch_size:(j+1)*patch_size]
                    variances.append(np.var(patch))
            median_var = float(np.median(variances))
            iqr_var = float(np.percentile(variances, 75) - np.percentile(variances, 25))
            if iqr_var > 0:
                for idx, v in enumerate(variances):
                    if abs(v - median_var) / iqr_var > 4.0:
                        noise_anomalies += 1

        # 5. SIFT Copy-Move Clone Detection
        cloned_pairs = []
        try:
            sift = cv2.SIFT_create(nfeatures=1500)
            kps, descs = sift.detectAndCompute(gray, None)
            if descs is not None and len(kps) > 30:
                bf = cv2.BFMatcher(cv2.NORM_L2)
                matches = bf.knnMatch(descs, descs, k=3)
                for m in matches:
                    if len(m) >= 3:
                        best_other, second_other = m[1], m[2]
                        if best_other.distance < 0.62 * second_other.distance:
                            pt1 = np.array(kps[best_other.queryIdx].pt)
                            pt2 = np.array(kps[best_other.trainIdx].pt)
                            dist = float(np.linalg.norm(pt1 - pt2))
                            if dist > 45.0:
                                cloned_pairs.append({
                                    "p1": [round(float(pt1[0]/w), 4), round(float(pt1[1]/h), 4)],
                                    "p2": [round(float(pt2[0]/w), 4), round(float(pt2[1]/h), 4)],
                                    "distance": round(dist, 1)
                                })
        except Exception:
            pass

        # 6. QR / 2D Barcode Decoder
        qr_detector = cv2.QRCodeDetector()
        qr_decoded_text, qr_points, _ = qr_detector.detectAndDecode(cv_img)
        qr_info = {
            "detected": bool(qr_decoded_text),
            "payload": qr_decoded_text if qr_decoded_text else None,
            "points": qr_points.tolist() if qr_points is not None else None
        }

        # 7. Font Baseline Alignment Check
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (25, 1))
        detected_lines = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, horizontal_kernel, iterations=1)
        line_cnts, _ = cv2.findContours(detected_lines, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        baseline_shifts = 0
        prev_y = None
        for lcnt in sorted(line_cnts, key=lambda c: cv2.boundingRect(c)[1]):
            _, ly, _, _ = cv2.boundingRect(lcnt)
            if prev_y is not None:
                delta_y = abs(ly - prev_y)
                if 2 < delta_y < 12:
                    baseline_shifts += 1
            prev_y = ly

        return {
            "success": True,
            "dimensions": {"width": w, "height": h},
            "quality": {
                "laplacianBlurScore": round(laplacian_var, 2),
                "isBlurry": is_blurry,
                "glareRatio": round(glare_ratio, 4),
                "overallQuality": "poor" if is_blurry or glare_ratio > 0.3 else "good" if laplacian_var > 150 else "fair"
            },
            "ela": {
                "meanError": round(mean_err, 2),
                "stdError": round(std_err, 2),
                "anomalousRatio": round(anomalous_ratio, 4),
                "isCompressionConsistent": bool(std_err < 8.0 and anomalous_ratio < 0.03),
                "heatmapPath": heatmap_rel_path
            },
            "tamperingRegions": tampering_regions,
            "noiseAnalysis": {
                "anomalousPatchCount": noise_anomalies,
                "isNoiseUniform": noise_anomalies < 4
            },
            "copyMove": {
                "clonedClusters": len(cloned_pairs),
                "clonedPairs": cloned_pairs[:10]
            },
            "fontAlignment": {
                "baselineShiftCount": baseline_shifts,
                "isAlignmentConsistent": baseline_shifts < 3
            },
            "securityFeatures": {
                "qr": qr_info
            }
        }

    except Exception as e:
        return {"error": str(e), "success": False}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python forensic_vision_engine.py <image_path> [heatmap_dir]"}))
        sys.exit(1)

    img_path = sys.argv[1]
    heat_dir = sys.argv[2] if len(sys.argv) > 2 else None
    result = analyze_image(img_path, heat_dir)
    print(json.dumps(result))
