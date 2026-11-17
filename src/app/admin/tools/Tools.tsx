"use client";

import { BookOpen } from "lucide-react";
import AlertsPanel from "./AlertsPanel";
import AzkaraPanel from "./AzkaraPanel";
import BackupPanel from "./BackupPanel";
import { Card } from "./Card";

/** the owner's tools: alerts, backup, the memorial message, and the printable book */
export default function Tools({ token }: { token: string }) {
  return (
    <div className="mt-6 flex flex-col gap-6">
      <BackupPanel token={token} />
      <AzkaraPanel />
      <Card icon={<BookOpen className="h-5 w-5" strokeWidth={1.6} aria-hidden />} title="ספר הזיכרונות להדפסה" lead="ספר מעוצב מכל מה שנאסף: סיפור החיים לפי עשורים, המילים שלה, מתכונים, סיפורים ותמונות. בוחרים מה ייכנס, רואים איך זה ייראה, ושומרים כ־PDF.">
        <a href="/admin/book" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-rose px-7 text-white hover:bg-burgundy">
          <BookOpen className="h-4 w-4" aria-hidden />
          לפתוח את הספר
        </a>
        <p className="mt-3 text-[0.88rem] text-ink-soft">בחינם, בלי שירות חיצוני: הדפדפן עצמו שומר את ה־PDF. הכי טוב ב־Chrome במחשב. אפשר לשלוח את הקובץ לבית דפוס ולהדפיס ככרך.</p>
      </Card>
      <AlertsPanel token={token} />
    </div>
  );
}
