import { useQuery } from "@tanstack/react-query";
import {
  getProducts,
  getProductByHandle,
  getCollections,
  getProductsByCollection,
} from "@/services/productService";

export const useProducts = () =>
  useQuery({ queryKey: ["products"], queryFn: getProducts });

export const useProduct = (handle?: string) =>
  useQuery({
    queryKey: ["product", handle],
    queryFn: () => getProductByHandle(handle!),
    enabled: !!handle,
  });

export const useCollections = () =>
  useQuery({ queryKey: ["collections"], queryFn: getCollections });

export const useProductsByCollection = (handle?: string) =>
  useQuery({
    queryKey: ["collection-products", handle],
    queryFn: () => getProductsByCollection(handle!),
    enabled: !!handle,
  });
