import { DocumentDetail } from '../../../components/Documents';
export default async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DocumentDetail id={id} />;
}
