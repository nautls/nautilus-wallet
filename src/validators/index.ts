import { ValidationRuleWithoutParams } from "@vuelidate/core";

import publicKey from "./publicKey";
import ergoAddress from "./ergoAddress";
import mnemonic from "./mnemonic";
import bigNumberMinVal from "./bigNumberMinVal";
import bigNumberMaxVal from "./bigNumberMaxVal";

export const validPublicKey: ValidationRuleWithoutParams = publicKey;
export const validErgoAddress: ValidationRuleWithoutParams = ergoAddress;
export const validMnemonic: ValidationRuleWithoutParams = mnemonic;
export const bigNumberMinValue = bigNumberMinVal;
export const bigNumberMaxValue = bigNumberMaxVal;
