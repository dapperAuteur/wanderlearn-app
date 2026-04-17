import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export async function renderCourseCertificatePdf(params: {
  courseTitle: string;
  learnerName: string;
  completedAt: Date;
  verifyUrl: string;
  dict: {
    titleLine: string;
    awardedLine: string;
    forLine: string;
    completedOnLabel: string;
    verifyLine: string;
    issuer: string;
  };
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${params.dict.titleLine} · ${params.courseTitle}`);
  pdf.setAuthor(params.dict.issuer);
  pdf.setCreationDate(params.completedAt);

  // Landscape letter: 792 × 612.
  const page = pdf.addPage([792, 612]);
  const { width, height } = page.getSize();

  const [helv, helvBold] = await Promise.all([
    pdf.embedFont(StandardFonts.Helvetica),
    pdf.embedFont(StandardFonts.HelveticaBold),
  ]);

  const ink = rgb(0.07, 0.09, 0.13);
  const accent = rgb(0.03, 0.47, 0.28);
  const muted = rgb(0.42, 0.45, 0.5);

  // Frame
  page.drawRectangle({
    x: 36,
    y: 36,
    width: width - 72,
    height: height - 72,
    borderColor: ink,
    borderWidth: 2,
  });
  page.drawRectangle({
    x: 48,
    y: 48,
    width: width - 96,
    height: height - 96,
    borderColor: muted,
    borderWidth: 0.5,
  });

  // Eyebrow
  const eyebrow = params.dict.issuer.toUpperCase();
  const eyebrowSize = 12;
  const eyebrowWidth = helv.widthOfTextAtSize(eyebrow, eyebrowSize);
  page.drawText(eyebrow, {
    x: (width - eyebrowWidth) / 2,
    y: height - 110,
    size: eyebrowSize,
    font: helv,
    color: muted,
  });

  // Title
  const title = params.dict.titleLine;
  const titleSize = 36;
  const titleWidth = helvBold.widthOfTextAtSize(title, titleSize);
  page.drawText(title, {
    x: (width - titleWidth) / 2,
    y: height - 165,
    size: titleSize,
    font: helvBold,
    color: ink,
  });

  // Awarded line
  const awarded = params.dict.awardedLine;
  const awardedSize = 14;
  const awardedWidth = helv.widthOfTextAtSize(awarded, awardedSize);
  page.drawText(awarded, {
    x: (width - awardedWidth) / 2,
    y: height - 215,
    size: awardedSize,
    font: helv,
    color: ink,
  });

  // Learner name
  const learnerSize = 28;
  const learnerWidth = helvBold.widthOfTextAtSize(params.learnerName, learnerSize);
  page.drawText(params.learnerName, {
    x: (width - learnerWidth) / 2,
    y: height - 260,
    size: learnerSize,
    font: helvBold,
    color: accent,
  });

  // For line
  const forLine = params.dict.forLine;
  const forSize = 14;
  const forWidth = helv.widthOfTextAtSize(forLine, forSize);
  page.drawText(forLine, {
    x: (width - forWidth) / 2,
    y: height - 305,
    size: forSize,
    font: helv,
    color: ink,
  });

  // Course title (may wrap in principle; v1 truncates if too long)
  const courseSize = 22;
  const courseText =
    params.courseTitle.length > 60
      ? `${params.courseTitle.slice(0, 57)}...`
      : params.courseTitle;
  const courseWidth = helvBold.widthOfTextAtSize(courseText, courseSize);
  page.drawText(courseText, {
    x: (width - courseWidth) / 2,
    y: height - 345,
    size: courseSize,
    font: helvBold,
    color: ink,
  });

  // Date
  const dateStr = formatLongDate(params.completedAt);
  const dateLine = `${params.dict.completedOnLabel} ${dateStr}`;
  const dateSize = 12;
  const dateWidth = helv.widthOfTextAtSize(dateLine, dateSize);
  page.drawText(dateLine, {
    x: (width - dateWidth) / 2,
    y: 140,
    size: dateSize,
    font: helv,
    color: ink,
  });

  // Verify URL (may be long)
  const verifyLabel = `${params.dict.verifyLine} ${params.verifyUrl}`;
  const verifySize = 9;
  const verifyWidth = helv.widthOfTextAtSize(verifyLabel, verifySize);
  page.drawText(verifyLabel, {
    x: Math.max(60, (width - verifyWidth) / 2),
    y: 90,
    size: verifySize,
    font: helv,
    color: muted,
  });

  return pdf.save();
}

function formatLongDate(d: Date): string {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}
