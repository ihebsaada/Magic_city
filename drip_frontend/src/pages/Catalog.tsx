import { CatalogueBrowser } from '@/components/CatalogueBrowser';
const Catalog = () => <div className="min-h-screen py-12"><div className="container mx-auto px-4">
  <h1 className="mb-4 font-serif text-4xl font-bold md:text-5xl">Catalogo</h1>
  <p className="mb-8 text-muted-foreground">Esplora la nostra collezione completa di sneakers luxury</p>
  <CatalogueBrowser />
</div></div>;
export default Catalog;
