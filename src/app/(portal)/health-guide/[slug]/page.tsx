import { notFound } from "next/navigation";
import { HealthGuideArticleView } from "@/components/health-guide-article";
import { PageHeader } from "@/components/ui";
import { getHealthGuidePostBySlug } from "@/lib/content/health-guide";

export default async function HealthGuideDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getHealthGuidePostBySlug(slug);

  if (!post) {
    notFound();
  }

  return (
    <>
      <PageHeader title="Cẩm nang sức khỏe" description="Thông tin hướng dẫn bệnh nhân chuẩn bị và theo dõi chăm sóc tại Bệnh viện Đa khoa An Phú." />
      <HealthGuideArticleView post={post} />
    </>
  );
}
