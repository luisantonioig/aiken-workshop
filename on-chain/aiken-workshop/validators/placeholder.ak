use aiken/collection/list
use cardano/transaction.{Transaction, OutputReference}
use aiken/crypto.{VerificationKeyHash}

validator placeholder {

  spend(_datum: Option<Data>, _redeemer: Data, _utxo: OutputReference, _self: Transaction) {
    True
  }
}

pub type SignatureDatum {
  owner: VerificationKeyHash
}

validator signature {
  spend(datum: Option<SignatureDatum>, _redeemer: Data, _utxo: OutputReference, self: Transaction) {
    expect Some(vkh) = datum
    list.has(self.extra_signatories, vkh.owner)
  }
}
