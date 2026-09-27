import { dbContext } from "@/database/dbContext";
import { IDbAddressBookEntry, NotNullId } from "@/types/database";

class AddressBookDbService {
  public async getByWalletId(walletId: number): Promise<NotNullId<IDbAddressBookEntry>[]> {
    const entries = await dbContext.addressBook.where("walletId").equals(walletId).toArray();
    return entries.sort((a, b) => a.name.localeCompare(b.name)) as NotNullId<IDbAddressBookEntry>[];
  }

  public async put(entry: IDbAddressBookEntry): Promise<number> {
    const existing = await dbContext.addressBook
      .where("[walletId+address]")
      .equals([entry.walletId, entry.address])
      .first();
    if (!entry.id) entry.id = existing?.id;

    return dbContext.addressBook.put(entry);
  }

  public async delete(id: number): Promise<void> {
    await dbContext.addressBook.delete(id);
  }
}

export const addressBookDbService = new AddressBookDbService();
