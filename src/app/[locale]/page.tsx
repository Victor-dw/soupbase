import { notFound } from "next/navigation";
import App from "@/components/app";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (locale !== "zh" && locale !== "en") notFound();
  return <App locale={locale} />;
}
