use cardano/assets.{PolicyId}
use aiken/crypto.{VerificationKeyHash}
use cardano/transaction.{Transaction, OutputReference}
use cardano/assets.{quantity_of}
use cardano/assets
use cardano/transaction
use aiken/collection/list.{has}

const stablecoin_token_name = "Euro Stablecoin"

pub type CollateralRedeemer {
  Redeem
  Liquidate
}

pub type CollateralDatum {
  col_minting_policy_id: PolicyId,
  col_owner: VerificationKeyHash,
  col_stablecoin_amount: Int,
}

/// Get the number (as Int) of the amount of tokens minted in this transaction.
pub fn get_total_minted_stablecoin(
  self: Transaction,
  policy_id: PolicyId,
) -> Int {
  quantity_of(self.mint, policy_id, stablecoin_token_name)
}


validator collateral {
  spend(
    optional_datum: Option<CollateralDatum>,
    redeemer: CollateralRedeemer,
    _own_ref: OutputReference,
    self: Transaction){

    expect Some(datum) = optional_datum
    let check_signed_by_col_owner =
          has(self.extra_signatories, datum.col_owner)


    /// Get the number (as Int) of the amount of tokens minted in this transaction.
    let stablecoin_minted =
      get_total_minted_stablecoin(self, datum.col_minting_policy_id)

    // /// Check if I'm burning in this transaction the same amount that was minted in
    // /// the transaction that created the collateral.
    // /// I care about this in all cases.
    let check_stablecoin_amount =
      -datum.col_stablecoin_amount == stablecoin_minted
    // Final Checks
    when redeemer is {
    // /// If I'm Liquidating, I only need to make sure I'm burning the correct
    // /// amount of stablecoins.
      Liquidate -> check_stablecoin_amount?
      // /// If I'm redeemeing, I have to make sure I'm burning the same amount of 
      // /// stablecoins I minted previously and that I'm the owner of the collateral.
      Redeem -> check_stablecoin_amount? && check_signed_by_col_owner?
    }
  }
}

const test_policy_id =
  #"00010203040506070809000102030405060708090001020304050607"

const test_owner =
  #"33330203040506070809333302030405060708093333020304050607"

const own_ref =
  OutputReference {
    transaction_id: transaction.placeholder.id,
    output_index: 0,
  }

fn test_datum(amount: Int) -> CollateralDatum {
  CollateralDatum {
    col_minting_policy_id: test_policy_id,
    col_owner: test_owner,
    col_stablecoin_amount: amount,
  }
}

test collateral_get_total_minted_stablecoin_reads_negative_mint() {
  let tx =
    Transaction {
      ..transaction.placeholder,
      mint: assets.from_asset(test_policy_id, stablecoin_token_name, -50),
    }

  get_total_minted_stablecoin(tx, test_policy_id) == -50
}

test collateral_redeem_accepts_matching_burn_and_owner_signature() {
  let tx =
    Transaction {
      ..transaction.placeholder,
      mint: assets.from_asset(test_policy_id, stablecoin_token_name, -250),
      extra_signatories: [test_owner],
    }

  collateral.spend(Some(test_datum(250)), Redeem, own_ref, tx)
}

test collateral_redeem_rejects_missing_owner_signature() {
  let tx =
    Transaction {
      ..transaction.placeholder,
      mint: assets.from_asset(test_policy_id, stablecoin_token_name, -250),
      extra_signatories: [],
    }

  !collateral.spend(Some(test_datum(250)), Redeem, own_ref, tx)
}

test collateral_liquidate_accepts_matching_burn_without_owner_signature() {
  let tx =
    Transaction {
      ..transaction.placeholder,
      mint: assets.from_asset(test_policy_id, stablecoin_token_name, -250),
      extra_signatories: [],
    }

  collateral.spend(Some(test_datum(250)), Liquidate, own_ref, tx)
}

test collateral_liquidate_rejects_wrong_burn_amount() {
  let tx =
    Transaction {
      ..transaction.placeholder,
      mint: assets.from_asset(test_policy_id, stablecoin_token_name, -200),
      extra_signatories: [],
    }

  !collateral.spend(Some(test_datum(250)), Liquidate, own_ref, tx)
}
