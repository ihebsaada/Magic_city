import { Truck, RefreshCcw, Headphones, CreditCard } from "lucide-react";

const services = [
  {
    icon: Truck,
    title: "Spedizione Rapida",
    description: "Consegna in 24-48h in tutta Italia",
  },
  {
    icon: RefreshCcw,
    title: "Reso & Cambio Taglia",
    description: "30 giorni per cambiare idea",
  },
  {
    icon: Headphones,
    title: "Supporto Online",
    description: "Assistenza dedicata sempre disponibile",
  },
  {
    icon: CreditCard,
    title: "Pagamenti Sicuri",
    description: "Transazioni protette e sicure",
  },
];

export const ServicesSection = () => {
  return (
    <section className="border-y bg-background py-12">
      <div className="container mx-auto px-4">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((service, index) => (
            <div
              key={index}
              className="flex flex-col items-center text-center transition-transform hover:scale-105"
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#eaeaea]">
                <service.icon className="h-8 w-8 text-black" />
              </div>
              <h3 className="mb-2 font-medium">{service.title}</h3>
              <p className="text-sm text-muted-foreground">
                {service.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
