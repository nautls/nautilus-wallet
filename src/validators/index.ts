import { ValidationRuleWithoutParams } from "@vuelidate/core";
import bigNumberMaxVal from "./bigNumberMaxVal";
import bigNumberMinVal from "./bigNumberMinVal";
import ergoAddress from "./ergoAddress";
import mnemonic from "./mnemonic";
import publicKey from "./publicKey";
import url from "./url";

export const validPublicKey: ValidationRuleWithoutParams = publicKey;
export const validErgoAddress: ValidationRuleWithoutParams = ergoAddress;
export const validMnemonic: ValidationRuleWithoutParams = mnemonic;
export const validUrl: ValidationRuleWithoutParams = url;
export const bigNumberMinValue = bigNumberMinVal;
export const bigNumberMaxValue = bigNumberMaxVal;
