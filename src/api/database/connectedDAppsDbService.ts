import { IDbDAppConnection } from "@/types/database";
import { dbContext } from "@/api/database/dbContext";

class ConnectedDAppsDbService {
  public async getFromOrigin(origin: string): Promise<IDbDAppConnection | undefined> {
    return await dbContext.connectedDApps.where("origin").equals(origin).first();
  }

  public async put(connection: IDbDAppConnection) {
    return await dbContext.connectedDApps.put(connection, connection.origin);
  }
}

export const connectedDAppsDbService = new ConnectedDAppsDbService();
