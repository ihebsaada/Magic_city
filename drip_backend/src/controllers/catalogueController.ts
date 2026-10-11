import {Request,Response} from "express";
import {readCatalogue} from "../services/catalogue";
import {CatalogueInputError} from "../services/productRead";
export async function getCatalogue(req:Request,res:Response) {
 try{return res.json(await readCatalogue(req.query));}
 catch(error){
  if(error instanceof CatalogueInputError)return res.status(400).json({error:error.message});
  return res.status(503).json({error:"CATALOGUE_RETRY"});
 }
}
