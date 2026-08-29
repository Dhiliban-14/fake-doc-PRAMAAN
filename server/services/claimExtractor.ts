import crypto from "node:crypto";

export interface ExtractedClaim {
  claimId: string;
  claimType:
    | "organization"
    | "department"
    | "notification_number"
    | "certificate_number"
    | "post"
    | "vacancy"
    | "application_deadline"
    | "date"
    | "website"
    | "phone"
    | "email"
    | "upi"
    | "fee"
    | "address"
    | "qr_destination";
  rawText: string;
  normalizedValue: string;
  sourceLocation: { line?: number; blockId?: string; offset?: number };
  ocrConfidence: number;
}

export function extractClaimsFromText(
  fullText: string,
  baseConfidence = 90,
  blocks: Array<{ id: string; text: string; confidence?: number }> = []
): ExtractedClaim[] {
  const claims: ExtractedClaim[] = [];
  if (!fullText || fullText.trim().length === 0) return claims;

  const lines = fullText.split(/\r?\n/);

  // Helper to push claim
  const addClaim = (
    type: ExtractedClaim["claimType"],
    raw: string,
    norm: string,
    lineIdx: number,
    conf = baseConfidence
  ) => {
    // Avoid duplicate normalized claims of same type
    if (claims.some((c) => c.claimType === type && c.normalizedValue === norm)) return;

    const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
    claims.push({
      claimId: `CLM-${hash}`,
      claimType: type,
      rawText: raw.trim(),
      normalizedValue: norm.trim(),
      sourceLocation: {
        line: lineIdx + 1,
        blockId: blocks[lineIdx]?.id ?? `line-${lineIdx + 1}`,
      },
      ocrConfidence: conf,
    });
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // 1. Notification Number (e.g. 17/2026, Advt. No. 04/2026, Notification No. 12/2025)
    const notifRegex = /(?:Notification|Notice|Advt\.?|Advertisement|Order)\s*(?:No\.?|Number)?\s*[:\-]?\s*([A-Za-z0-9\/\-_]+(?:\/\d{4})?)/i;
    const notifMatch = trimmed.match(notifRegex);
    if (notifMatch) {
      addClaim("notification_number", notifMatch[0], notifMatch[1].toUpperCase(), idx);
    } else {
      const standAloneNotif = trimmed.match(/\b([A-Z0-9]{2,}\/\d{4})\b/);
      if (standAloneNotif) {
        addClaim("notification_number", standAloneNotif[0], standAloneNotif[1].toUpperCase(), idx);
      }
    }

    // 2. Organization / Department
    if (/department|ministry|commission|board|authority|directorate|corporation/i.test(trimmed)) {
      if (trimmed.length < 90 && !/fee|deadline|date|upi|phone|email/i.test(trimmed)) {
        addClaim("organization", trimmed, trimmed, idx);
      }
    }

    // 3. Application Deadline / Important Dates
    const deadlineRegex = /(?:last date|closing date|deadline|submission date|valid till|valid up to)\s*[:\-]?\s*(\d{1,2}[\/\-\.][A-Za-z0-9]{2,}[\/\-\.]\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})/i;
    const deadlineMatch = trimmed.match(deadlineRegex);
    if (deadlineMatch) {
      addClaim("application_deadline", deadlineMatch[0], deadlineMatch[1], idx);
    } else {
      const generalDate = trimmed.match(/\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})\b/i);
      if (generalDate && !/birth|dob/i.test(trimmed)) {
        addClaim("date", generalDate[0], generalDate[1], idx);
      }
    }

    // 4. Website / Domain
    const urlRegex = /(?:https?:\/\/)?([a-zA-Z0-9_\-]+\.(?:gov\.in|nic\.in|ac\.in|edu\.in|org\.in|com|org|net|in|co|info|biz)(?:\/[a-zA-Z0-9_\-\.\/?&=%]*)?)/gi;
    let urlMatch: RegExpExecArray | null;
    while ((urlMatch = urlRegex.exec(trimmed)) !== null) {
      const rawUrl = urlMatch[0];
      const host = urlMatch[1].toLowerCase().replace(/^https?:\/\//, "").split("/")[0];
      addClaim("website", rawUrl, host, idx);
    }

    // 5. UPI / Payment ID (e.g. name@okhdfcbank, payments@upi, fees@paytm)
    const upiRegex = /([a-zA-Z0-9.\-_]{2,}@(okhdfcbank|okaxis|okicici|paytm|upi|ybl|axl|ibl|apl|ptsbi|barodampay|postbank|sbi|kotak|federal))/gi;
    let upiMatch: RegExpExecArray | null;
    while ((upiMatch = upiRegex.exec(trimmed)) !== null) {
      addClaim("upi", upiMatch[0], upiMatch[0].toLowerCase(), idx);
    }

    // 6. Application Fee / Monetary amounts (e.g. ₹500, Rs. 250, INR 1000)
    const feeRegex = /(?:fee|amount|charges?|registration)\s*[:\-]?\s*(?:₹|Rs\.?|INR)\s*(\d+(?:,\d+)*(?:\.\d{2})?)/i;
    const feeMatch = trimmed.match(feeRegex);
    if (feeMatch) {
      addClaim("fee", feeMatch[0], `₹${feeMatch[1]}`, idx);
    } else {
      const standaloneAmt = trimmed.match(/(?:₹|Rs\.?)\s*(\d{2,6})/i);
      if (standaloneAmt) {
        addClaim("fee", standaloneAmt[0], `₹${standaloneAmt[1]}`, idx);
      }
    }

    // 7. Phone / Contact Number
    const phoneRegex = /(?:\+91[\-\s]?)?[6-9]\d{4}[\-\s]?\d{5}\b/g;
    let phoneMatch: RegExpExecArray | null;
    while ((phoneMatch = phoneRegex.exec(trimmed)) !== null) {
      const cleanDigits = phoneMatch[0].replace(/\D/g, "");
      const normalized = cleanDigits.length === 10 ? `+91${cleanDigits}` : `+${cleanDigits}`;
      addClaim("phone", phoneMatch[0], normalized, idx);
    }

    // 8. Email Address
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
    let emailMatch: RegExpExecArray | null;
    while ((emailMatch = emailRegex.exec(trimmed)) !== null) {
      const email = emailMatch[0].toLowerCase();
      if (!email.includes("@upi") && !email.includes("@okhdfcbank")) {
        addClaim("email", emailMatch[0], email, idx);
      }
    }

    // 9. Post / Vacancy Title
    const postRegex = /(?:post of|recruitment to the post of|position of|vacancy for)\s*[:\-]?\s*([A-Za-z\s]{3,40})/i;
    const postMatch = trimmed.match(postRegex);
    if (postMatch) {
      addClaim("post", postMatch[0], postMatch[1].trim(), idx);
    }
  });

  return claims;
}
