"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Preferences } from "../preferences";
import { StudentDirectory } from "../students/students-workspace";
import { createSampleStudentActions, sampleStudentScope } from "./student-fixtures";

export function StudentsPreview() {
  const t = useTranslations("students");
  const [actions] = useState(createSampleStudentActions);
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto w-full min-w-0 max-w-4xl space-y-7 px-5 py-8 outline-none wrap-anywhere"
    >
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/tasarim#students" className="text-sm underline underline-offset-4">
          {t("demoBack")}
        </Link>
        <Preferences />
      </header>
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("demoTitle")}</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{t("demoHint")}</p>
      </div>
      <StudentDirectory scope={sampleStudentScope} centerName="Fethiye" actions={actions} />
    </main>
  );
}
