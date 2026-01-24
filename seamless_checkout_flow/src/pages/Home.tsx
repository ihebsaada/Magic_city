// import { ShoppingBag, Shirt, Package } from "lucide-react";
// import { Button } from "@/components/ui/button";
// import { Card, CardContent, CardFooter } from "@/components/ui/card";
// import { addToCart, getCart } from "@/lib/cart";
// import { toast } from "sonner";
// import Navigation from "@/components/Navigation";

// interface ProductCategory {
//   id: string;
//   name: string;
//   price: number;
//   icon: React.ReactNode;
//   image: string;
// }

// const categories: ProductCategory[] = [
//   {
//     id: "shoes",
//     name: "Shoes",
//     price: 12000,
//     icon: <Package className="h-6 w-6" />,
//     image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=300&fit=crop",
//   },
//   {
//     id: "bags",
//     name: "Bags",
//     price: 18000,
//     icon: <ShoppingBag className="h-6 w-6" />,
//     image: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&h=300&fit=crop",
//   },
//   {
//     id: "outerwear",
//     name: "Clothing / Outerwear",
//     price: 25000,
//     icon: <Shirt className="h-6 w-6" />,
//     image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400&h=300&fit=crop",
//   },
//   {
//     id: "dresses",
//     name: "Clothing / Dresses",
//     price: 15000,
//     icon: <Shirt className="h-6 w-6" />,
//     image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400&h=300&fit=crop",
//   },
//   {
//     id: "tops",
//     name: "Clothing / Tops",
//     price: 8000,
//     icon: <Shirt className="h-6 w-6" />,
//     image: "https://images.unsplash.com/photo-1562157873-818bc0726f68?w=400&h=300&fit=crop",
//   },
// ];

// const Home = () => {
//   const handleAddToCart = (category: ProductCategory) => {
//     const cart = getCart();
//     const itemNumber = cart.length + 1;

//     const genericNames: Record<string, string> = {
//       shoes: "Premium Footwear",
//       bags: "Designer Bag",
//       outerwear: "Premium Outerwear",
//       dresses: "Designer Dress",
//       tops: "Premium Top",
//     };

//     addToCart({
//       id: `${category.id}-${Date.now()}`,
//       name: genericNames[category.id] || `Item ${itemNumber}`,
//       description: `Quality ${category.name.toLowerCase()} item`,
//       price: category.price,
//       quantity: 1,
//     });

//     toast.success("Added to cart", {
//       description: `${genericNames[category.id]} has been added to your cart`,
//     });
//   };

//   const formatPrice = (cents: number) => {
//     return new Intl.NumberFormat("en-US", {
//       style: "currency",
//       currency: "USD",
//     }).format(cents / 100);
//   };

//   return (
//     <div className="min-h-screen bg-background flex flex-col">
//       <Navigation />

//       <main className="flex-1 container mx-auto px-4 py-12">
//         <div className="max-w-6xl mx-auto">
//           <div className="text-center mb-12 animate-fade-in">
//             <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 tracking-tight">
//               Shop Collection
//             </h1>
//             <p className="text-lg text-muted-foreground max-w-md mx-auto">
//               Browse our curated selection of premium products
//             </p>
//           </div>

//           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-slide-up">
//             {categories.map((category) => (
//               <Card
//                 key={category.id}
//                 className="group overflow-hidden border-border/50 bg-card hover:border-accent/50 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5"
//               >
//                 <div className="aspect-[4/3] overflow-hidden bg-muted">
//                   <img
//                     src={category.image}
//                     alt={category.name}
//                     className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
//                   />
//                 </div>
//                 <CardContent className="p-5">
//                   <div className="flex items-center gap-2 text-accent mb-2">
//                     {category.icon}
//                     <span className="text-xs font-medium uppercase tracking-wider">
//                       {category.name.split(" / ")[0]}
//                     </span>
//                   </div>
//                   <h3 className="text-lg font-semibold text-foreground mb-1">
//                     {category.name}
//                   </h3>
//                   <p className="text-2xl font-bold text-foreground">
//                     {formatPrice(category.price)}
//                   </p>
//                 </CardContent>
//                 <CardFooter className="p-5 pt-0">
//                   <Button
//                     onClick={() => handleAddToCart(category)}
//                     className="w-full bg-accent text-accent-foreground hover:bg-accent/90 transition-colors"
//                   >
//                     <ShoppingBag className="mr-2 h-4 w-4" />
//                     Add to Cart
//                   </Button>
//                 </CardFooter>
//               </Card>
//             ))}
//           </div>
//         </div>
//       </main>

//       <footer className="border-t border-border py-6">
//         <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
//           Secure shopping experience
//         </div>
//       </footer>
//     </div>
//   );
// };

// export default Home;
import { ShoppingBag, Shirt, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { addToCart, getCart } from "@/lib/cart";
import { toast } from "sonner";
import Navigation from "@/components/Navigation";

interface ProductCategory {
  id: string;
  name: string;
  price: number;
  icon: React.ReactNode;
  image: string;
}

const categories: ProductCategory[] = [
  {
    id: "shoes",
    name: "Scarpe",
    price: 12000,
    icon: <Package className="h-6 w-6" />,
    image: "/sneaker.png",
  },
  {
    id: "bags",
    name: "Borse",
    price: 18000,
    icon: <ShoppingBag className="h-6 w-6" />,
    image: "/bag.png",
  },
  {
    id: "outerwear",
    name: "Abbigliamento / Capispalla",
    price: 25000,
    icon: <Shirt className="h-6 w-6" />,
    image:
      "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400&h=300&fit=crop",
  },
  {
    id: "dresses",
    name: "Abbigliamento / Vestiti",
    price: 15000,
    icon: <Shirt className="h-6 w-6" />,
    image:
      "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400&h=300&fit=crop",
  },
  {
    id: "tops",
    name: "Abbigliamento / Top",
    price: 8000,
    icon: <Shirt className="h-6 w-6" />,
    image:
      "https://images.unsplash.com/photo-1562157873-818bc0726f68?w=400&h=300&fit=crop",
  },
];

const Home = () => {
  const handleAddToCart = (category: ProductCategory) => {
    const cart = getCart();
    const itemNumber = cart.length + 1;

    const genericNames: Record<string, string> = {
      shoes: "Calzature premium",
      bags: "Borsa di design",
      outerwear: "Capospalla premium",
      dresses: "Abito di design",
      tops: "Top premium",
    };

    addToCart({
      id: `${category.id}-${Date.now()}`,
      name: genericNames[category.id] || `Articolo ${itemNumber}`,
      description: `Articolo di ${category.name.toLowerCase()} di qualità`,
      price: category.price,
      quantity: 1,
    });

    toast.success("Aggiunto al carrello", {
      description: `${
        genericNames[category.id]
      } è stato aggiunto al tuo carrello`,
    });
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />

      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 animate-fade-in">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 tracking-tight">
              Collezione Shop
            </h1>
            <p className="text-lg text-muted-foreground max-w-md mx-auto">
              Scopri la nostra selezione curata di prodotti premium
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-slide-up">
            {categories.map((category) => (
              <Card
                key={category.id}
                className="group overflow-hidden border-border/50 bg-card hover:border-accent/50 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5"
              >
                <div className="aspect-[4/3] overflow-hidden bg-muted">
                  <img
                    src={category.image}
                    alt={category.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 text-accent mb-2">
                    {category.icon}
                    <span className="text-xs font-medium uppercase tracking-wider">
                      {category.name.split(" / ")[0]}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-1">
                    {category.name}
                  </h3>
                  <p className="text-2xl font-bold text-foreground">
                    {formatPrice(category.price)}
                  </p>
                </CardContent>
                <CardFooter className="p-5 pt-0">
                  <Button
                    onClick={() => handleAddToCart(category)}
                    className="w-full bg-accent text-accent-foreground hover:bg-accent/90 transition-colors"
                  >
                    <ShoppingBag className="mr-2 h-4 w-4" />
                    Aggiungi al carrello
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </main>

      <footer className="border-t border-border py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Esperienza di acquisto sicura
        </div>
      </footer>
    </div>
  );
};

export default Home;
