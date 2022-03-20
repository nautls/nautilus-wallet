import { decodeColl, decodeCollTuple } from "../../src/api/ergo/sigmaSerializer";

describe("sigma serializer", () => {
  // example from https://github.com/ergoplatform/eips/blob/master/eip-0004.md#ergo-tokens-standard
  it("decode Coll[Byte] as string", () => {
    expect(decodeColl("0e03555344")).toEqual("USD");
    expect(decodeColl("0e184e6f7468696e67206261636b65642055534420746f6b656e")).toEqual(
      "Nothing backed USD token"
    );
    expect(decodeColl("0e0132")).toEqual("2");
  });

  it("decode Coll[Byte] tuple as string", () => {
    expect(
      decodeCollTuple(
        "3c0e0e42697066733a2f2f6261667962656968356169676b7271696f70796c6876763234757465686a62336f70746433786861786c686568376e366465346b6c6f756c666d6142697066733a2f2f6261666b726569677a6b74796b62706b62706b6e6f667068766d6165327a3262777a716467336172746e32366e6e787237616b616c376c6e6d326d"
      )
    ).toEqual([
      "ipfs://bafybeih5aigkrqiopylhvv24utehjb3optd3xhaxlheh7n6de4kloulfma",
      "ipfs://bafkreigzktykbpkbpknofphvmae2z2bwzqdg3artn26nnxr7akal7lnm2m"
    ]);
  });
});
