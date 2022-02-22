import { IDbBox } from "@/types/database";
import { dbContext } from "@/api/database/dbContext";

class BoxesDbService {
  public async getById(id: string): Promise<IDbBox | undefined> {
    return await dbContext.boxes.where("id").equals(id).first();
  }

  public async getAll(): Promise<IDbBox[]> {
    return await dbContext.boxes.toArray();
  }
}

export const boxesDbService = new BoxesDbService();
