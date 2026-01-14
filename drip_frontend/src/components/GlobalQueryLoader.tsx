// // import { useIsFetching, useIsMutating } from "@tanstack/react-query";
// // import { LoadingScreen } from "./LoadingScreen";

// // export const GlobalQueryLoader = () => {
// //   const fetchingCount = useIsFetching();
// //   const mutatingCount = useIsMutating();

// //   const isLoading = fetchingCount + mutatingCount > 0;

// //   if (!isLoading) return null;

// //   return <LoadingScreen />;
// // };
// // src/components/GlobalQueryLoader.tsx
// import { ReactNode } from "react";

// type Props = {
//   children?: ReactNode;
// };

// // Le loader global est maintenant géré dans Layout.tsx.
// // On ne rend plus de LoadingScreen ici.
// export const GlobalQueryLoader = ({ children }: Props) => {
//   return <>{children}</>;
// };
