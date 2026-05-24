import { DraftBoard } from "@/components/DraftBoard";

export default async function DraftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DraftBoard draftId={id} />;
}
