import { useParams } from 'react-router-dom';
import { CatalogueBrowser } from '@/components/CatalogueBrowser';
import { useCatalogue, useCollections } from '@/hooks/useProducts';
const CollectionDetail = () => {
  const { collectionHandle } = useParams<{ collectionHandle: string }>();
  const cover = useCatalogue({ collection: collectionHandle, pageSize: 1 }, !!collectionHandle);
  const collections = useCollections();
  const title = collections.data?.find((item) => item.handle === collectionHandle)?.title ?? collectionHandle?.split('-').join(' ');
  const image = cover.data?.items[0]?.mainImage;
  return <div className="min-h-screen">
    {image && <div className="relative h-[400px] overflow-hidden">
      <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative flex h-full items-center justify-center"><h1 className="font-serif text-5xl font-bold text-white">{title}</h1></div>
    </div>}
    <div className="container mx-auto px-4 py-12">
      {!image && <h1 className="mb-8 font-serif text-4xl font-bold">{title}</h1>}
      <CatalogueBrowser key={collectionHandle} collection={collectionHandle} />
    </div>
  </div>;
};
export default CollectionDetail;
