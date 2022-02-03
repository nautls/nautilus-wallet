import { IDbDAppConnection } from "@/types/database";
import { dbContext } from "@/api/database/dbContext";

class ConnectedDAppsDbService {
  public async getByOrigin(origin: string): Promise<IDbDAppConnection | undefined> {
    return await dbContext.connectedDApps.where("origin").equals(origin).first();
  }

  public async getAll(): Promise<IDbDAppConnection[]> {
    return await dbContext.connectedDApps.toArray();
  }

  public async put(connection: IDbDAppConnection) {
    return await dbContext.connectedDApps.put(connection, connection.origin);
  }

  public async deleteByOrigin(origin: string) {
    return await dbContext.connectedDApps.delete(origin);
  }
}

export const connectedDAppsDbService = new ConnectedDAppsDbService();
