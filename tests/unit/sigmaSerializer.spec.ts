import {
  decodeColl,
  decodeCollTuple,
  extractPksFromRegisters
} from "../../src/api/ergo/sigmaSerializer";

describe("sigma serializer", () => {
  // example from https://github.com/ergoplatform/eips/blob/master/eip-0004.md#ergo-tokens-standard
  it("decode Coll[Byte] as string", () => {
    expect(decodeColl("0e03555344")).toEqual("USD");
    expect(decodeColl("0e184e6f7468696e67206261636b65642055534420746f6b656e")).toEqual(
      "Nothing backed USD token"
    );
    expect(decodeColl("0e0132")).toEqual("2");
  });

  it("decode long Coll[Byte] as string", () => {
    expect(
      decodeColl(
        "0ede067b0a202022373231223a207b0a20202020224672756974795361677561726f2023303533223a207b0a202020202020226e616d65223a20224672756974795361677561726f2023303533222c0a202020202020226465736372697074696f6e223a202245787472616f7264696e61727920667275697479207361677561726f2073706563696573222c0a20202020202022696d616765223a2022697066733a2f2f516d534744397975626a77666d324a515656746a474a3546774e76483443353166655a744c705570547246696d4b222c0a2020202020202265646974696f6e223a2035332c0a2020202020202261747472696275746573223a207b0a2020202020202020224261636b67726f756e64223a20227768697465222c0a20202020202020202253616e64223a202279656c6c6f77222c0a202020202020202022426f6479223a2022707572706c65222c0a2020202020202020224f75746c696e65223a2022626c61636b222c0a20202020202020202245796573223a20226f7264696e6172795f677265656e222c0a2020202020202020225072696d617279206672756974223a2022677265656e222c0a2020202020202020225365636f6e64617279206672756974223a20226e6f6e65222c0a20202020202020202242656c74223a20226e6f6e65222c0a2020202020202020224265617264223a20226e6f6e65222c0a202020202020202022476c6173736573223a20226e6f6e65222c0a202020202020202022486174223a20226e6f6e65222c0a2020202020202020224d6f757468223a20226861707079222c0a202020202020202022526f636b73223a20226e6f6e65220a2020202020207d2c0a2020202020202266696c6573223a205b0a20202020202020207b0a20202020202020202020226e616d65223a20224672756974795361677561726f2023303533222c0a2020202020202020202022737263223a2022697066733a2f2f516d534744397975626a77666d324a515656746a474a3546774e76483443353166655a744c705570547246696d4b222c0a20202020202020202020226d6564696154797065223a2022696d6167652f706e67220a20202020202020207d0a2020202020205d2c0a202020202020226d6564696154797065223a2022696d6167652f706e67220a202020207d0a20207d0a7d"
      )
    ).toEqual(
      '{\n  "721": {\n    "FruitySaguaro #053": {\n      "name": "FruitySaguaro #053",\n      "description": "Extraordinary fruity saguaro species",\n      "image": "ipfs://QmSGD9yubjwfm2JQVVtjGJ5FwNvH4C51feZtLpUpTrFimK",\n      "edition": 53,\n      "attributes": {\n        "Background": "white",\n        "Sand": "yellow",\n        "Body": "purple",\n        "Outline": "black",\n        "Eyes": "ordinary_green",\n        "Primary fruit": "green",\n        "Secondary fruit": "none",\n        "Belt": "none",\n        "Beard": "none",\n        "Glasses": "none",\n        "Hat": "none",\n        "Mouth": "happy",\n        "Rocks": "none"\n      },\n      "files": [\n        {\n          "name": "FruitySaguaro #053",\n          "src": "ipfs://QmSGD9yubjwfm2JQVVtjGJ5FwNvH4C51feZtLpUpTrFimK",\n          "mediaType": "image/png"\n        }\n      ],\n      "mediaType": "image/png"\n    }\n  }\n}'
    );
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

  it("decode Coll[Byte] as hex string", () => {
    expect(decodeColl("0e020101", "hex")).toEqual("0101");
    expect(decodeColl("0e020102", "hex")).toEqual("0102");
    expect(decodeColl("0e020103", "hex")).toEqual("0103");
    expect(decodeColl("0e020201", "hex")).toEqual("0201");
  });

  it("extract public key from registers with two possible pk consts", () => {
    expect(
      extractPksFromRegisters({
        R4: "0580c0fc82aa02",
        R5: "0e240008cd036b84756b351ee1c57fd8c302e66a1bb927e5d8b6e1a8e085935de3971f84ae17",
        R7: "07036b84756b351ee1c57fd8c302e66a1bb927e5d8b6e1a8e085935de3971f84ae17"
      })
    ).toEqual([
      "036b84756b351ee1c57fd8c302e66a1bb927e5d8b6e1a8e085935de3971f84ae17",
      "036b84756b351ee1c57fd8c302e66a1bb927e5d8b6e1a8e085935de3971f84ae17"
    ]);
  });

  it("extract public key from registers with 08cd prefixed pk const", () => {
    expect(
      extractPksFromRegisters({
        R4: "0580c0fc82aa02",
        R5: "0e240008cd036b84756b351ee1c57fd8c302e66a1bb927e5d8b6e1a8e085935de3971f84ae17"
      })
    ).toEqual(["036b84756b351ee1c57fd8c302e66a1bb927e5d8b6e1a8e085935de3971f84ae17"]);
  });

  it("extract public key from registers with GroupElement", () => {
    expect(
      extractPksFromRegisters({
        R4: "0580c0fc82aa02",
        R7: "07036b84756b351ee1c57fd8c302e66a1bb927e5d8b6e1a8e085935de3971f84ae17"
      })
    ).toEqual(["036b84756b351ee1c57fd8c302e66a1bb927e5d8b6e1a8e085935de3971f84ae17"]);
  });
});
