import { dbContext } from "@/database/dbContext";
import { IDbDAppConnection } from "@/types/database";

class ConnectedDAppsDbService {
  public async getByOrigin(origin: string): Promise<IDbDAppConnection | undefined> {
    return dbContext.connectedDApps.where("origin").equals(origin).first();
  }

  public async getAll(): Promise<IDbDAppConnection[]> {
    return dbContext.connectedDApps.toArray();
  }

  public async put(connection: IDbDAppConnection) {
    return dbContext.connectedDApps.put(connection, connection.origin);
  }

  public async deleteByOrigin(origin: string) {
    return dbContext.connectedDApps.delete(origin);
  }
}

export const connectedDAppsDbService = new ConnectedDAppsDbService();
