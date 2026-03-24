use aiken/collection/dict
use aiken/collection/list
use cardano/transaction.{OutputReference, Transaction, InlineDatum}
use cardano/assets.{PolicyId, policies}
use aiken/crypto.{VerificationKeyHash}
use cardano/address.{Script, from_script}
use cardano/address
use cardano/assets
use cardano/transaction

pub type MintAction {
  Minting
  Burning
}

pub type SpendAction {
  Update
  Burn
}

fn check_oracle_mint(
  utxo_ref: OutputReference,
  operator: VerificationKeyHash,
  action: MintAction,
  policy_id: PolicyId,
  self: Transaction,
) {
  let Transaction { inputs, outputs, mint, .. } = self
  let is_signed_by_operator =
    list.has(self.extra_signatories, operator)

  expect [Pair(_asset_name, quantity)] = mint
    |> assets.tokens(policy_id)
    |> dict.to_pairs()

  when action is {
    Minting -> {
      let is_output_consumed =
        list.any(inputs, fn(input) { input.output_reference == utxo_ref })

      expect Some(nft_output) =
        list.find(
          outputs,
          fn(output) { list.has(policies(output.value), policy_id) },
        )

      expect InlineDatum(datum) = nft_output.datum
      expect _rate: Int = datum

      let policy_address = from_script(policy_id)
      expect nft_output.address == policy_address
      is_output_consumed? && (quantity == 1)? && is_signed_by_operator
    }
    Burning -> (quantity == -1)? && is_signed_by_operator
  }
}

fn check_oracle_spend(
  operator: VerificationKeyHash,
  action: SpendAction,
  own_ref: OutputReference,
  self: Transaction,
) {
  let is_signed_by_operator =
    list.has(self.extra_signatories, operator)

  when action is {
    Update -> {
      let Transaction { inputs, outputs, .. } = self
      expect Some(own_input) =
        list.find(inputs, fn(input) { input.output_reference == own_ref })
      expect Script(own_script_hash) = own_input.output.address.payment_credential

      expect Some(nft_input) =
        list.find(
          inputs,
          fn(input) { list.has(policies(input.output.value), own_script_hash) },
        )

      expect InlineDatum(input_datum) = nft_input.output.datum
      expect _rate: Int = input_datum

      expect Some(nft_output) =
        list.find(
          outputs,
          fn(output) { list.has(policies(output.value), own_script_hash) },
        )
      expect InlineDatum(output_datum) = nft_output.datum
      expect _rate: Int = output_datum

      expect nft_input.output.address == nft_output.address
      is_signed_by_operator?
    }
    Burn -> {
      is_signed_by_operator?
    }
  }
}

validator oracle(utxo_ref: OutputReference, operator: VerificationKeyHash) {
  mint(action: MintAction, policy_id: PolicyId, self: Transaction) {
    check_oracle_mint(utxo_ref, operator, action, policy_id, self)
  }

  spend(
    _optional_datum: Option<Data>,
    action: SpendAction,
    own_ref: OutputReference,
    self: Transaction,
  ) {
    check_oracle_spend(operator, action, own_ref, self)
  }
}

const test_policy_id =
  #"44440203040506070809444402030405060708094444020304050607"

const test_operator =
  #"55550203040506070809555502030405060708095555020304050607"

const test_utxo_ref =
  OutputReference {
    transaction_id: transaction.placeholder.id,
    output_index: 0,
  }

fn nft_value(quantity: Int) {
  assets.from_asset(test_policy_id, #"4f52434c", quantity)
}

fn oracle_script_output(rate: Int) {
  transaction.Output {
    address: address.from_script(test_policy_id),
    value: nft_value(1),
    datum: InlineDatum(rate),
    reference_script: None,
  }
}

fn oracle_script_input(rate: Int) {
  transaction.Input {
    output_reference: test_utxo_ref,
    output:
      transaction.Output {
        address: address.from_script(test_policy_id),
        value: nft_value(1),
        datum: InlineDatum(rate),
        reference_script: None,
      },
  }
}

test oracle_mint_accepts_operator_signed_nft_creation() {
  let tx =
    Transaction {
      ..transaction.placeholder,
      inputs: [oracle_script_input(100)],
      outputs: [oracle_script_output(100)],
      mint: nft_value(1),
      extra_signatories: [test_operator],
    }

  check_oracle_mint(test_utxo_ref, test_operator, Minting, test_policy_id, tx)
}

test oracle_mint_rejects_missing_operator_signature() {
  let tx =
    Transaction {
      ..transaction.placeholder,
      inputs: [oracle_script_input(100)],
      outputs: [oracle_script_output(100)],
      mint: nft_value(1),
      extra_signatories: [],
    }

  !check_oracle_mint(test_utxo_ref, test_operator, Minting, test_policy_id, tx)
}

test oracle_burn_accepts_negative_quantity_signed_by_operator() {
  let tx =
    Transaction {
      ..transaction.placeholder,
      mint: nft_value(-1),
      extra_signatories: [test_operator],
    }

  check_oracle_mint(test_utxo_ref, test_operator, Burning, test_policy_id, tx)
}

test oracle_update_accepts_operator_and_preserves_script_address() {
  let tx =
    Transaction {
      ..transaction.placeholder,
      inputs: [oracle_script_input(100)],
      outputs: [oracle_script_output(120)],
      extra_signatories: [test_operator],
    }

  check_oracle_spend(test_operator, Update, test_utxo_ref, tx)
}

test oracle_update_rejects_missing_operator_signature() {
  let tx =
    Transaction {
      ..transaction.placeholder,
      inputs: [oracle_script_input(100)],
      outputs: [oracle_script_output(120)],
      extra_signatories: [],
    }

  !check_oracle_spend(test_operator, Update, test_utxo_ref, tx)
}
