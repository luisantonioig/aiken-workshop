use aiken/crypto.{ScriptHash, VerificationKeyHash}
use cardano/assets.{PolicyId, lovelace_of,quantity_of}
use cardano/transaction.{Transaction,Input,NoDatum,DatumHash,InlineDatum, Output, find_script_outputs}
use aiken/collection/list
use cardano/address.{Script}

const stablecoin_token_name = "Euro Stablecoin"

pub type CollateralDatum {
  col_minting_policy_id: PolicyId,
  col_owner: VerificationKeyHash,
  col_stablecoin_amount: Int,
}

pub type MintingParams {
  oracle_validator: ScriptHash,
  collateral_validator: ScriptHash,
  collateral_min_percent: Int,
}

pub type Action {
  Minting
  Burning
  Liquidating
}

validator minting(params: MintingParams){
  mint(action: Action, policy_id: PolicyId, self: Transaction){
    when action is {
      Minting -> and {
          check_mint_positive(policy_id, self),
          check_collateral_output_datum(params, policy_id, self),
          check_max_mint(params, policy_id, self),
        }
      Burning -> and {
        check_burn_negative(policy_id, self),
        check_burn_matches_datum(params, policy_id, self),
        check_owner_signature(params, self)
      }
      Liquidating -> and {
        check_burn_negative(policy_id, self),
        check_burn_matches_datum(params, policy_id, self),
        check_liquidation(params, policy_id, self)
      }
    }
  }
}

fn check_max_mint(params: MintingParams, policy_id: PolicyId, self: Transaction){
  let oracle_rate: Int =
      get_oracle_rate(
        self.reference_inputs,
        params.oracle_validator,
      )

  // /// Get collateral output
    expect [collateral_output]: List<Output> =
      find_script_outputs(
        self.outputs,
        params.collateral_validator,
      )

    // /// Get collateral's output amount of lovelaces being locked
    let collateral_output_amount: Int = lovelace_of(collateral_output.value)

  let stablecoin_minted_amount: Int =
      get_total_minted_stablecoin(self, policy_id)

  max_mint(
    collateral_output_amount,
    oracle_rate,
    params.collateral_min_percent,
  ) >= stablecoin_minted_amount
}

fn check_liquidation(params: MintingParams, policy_id: PolicyId, self: Transaction){

  expect [collateral_input]: List<Output> =
    find_script_outputs(
      list.map(self.inputs, fn(i) { i.output }),
      params.collateral_validator,
    )

  let oracle_rate: Int =
      get_oracle_rate(
        self.reference_inputs,
        params.oracle_validator,
      )

  let collateral_input_amount: Int = lovelace_of(collateral_input.value)

  let stablecoin_minted_amount: Int =
      get_total_minted_stablecoin(self, policy_id)

  // /// Check if the collateral's value is low enough to liquidate
      max_mint(
        collateral_input_amount,
        oracle_rate,
        params.collateral_min_percent,
      ) < -stablecoin_minted_amount
}

fn check_collateral_output_datum(params: MintingParams, policy_id: PolicyId, self: Transaction){
  // /// Get collateral output
    expect [collateral_output]: List<Output> =
      find_script_outputs(
        self.outputs,
        params.collateral_validator,
      )

    // /// Parse collateral output datum
    let collateral_output_datum: CollateralDatum =
      get_collateral_datum(collateral_output)

   let stablecoin_minted_amount: Int =
      get_total_minted_stablecoin(self, policy_id)

     /// Check that the collateral's output datum has the correct values
    let check_collateral_output_datum: Bool = and {
        collateral_output_datum.col_stablecoin_amount == stablecoin_minted_amount,
        collateral_output_datum.col_minting_policy_id == policy_id,
        list.has(
          self.extra_signatories,
          collateral_output_datum.col_owner,
        ),
      }
    check_collateral_output_datum
}

fn check_mint_positive(policy_id: PolicyId, self: Transaction) -> Bool{
  let stablecoin_minted_amount: Int =
      get_total_minted_stablecoin(self, policy_id)
  // /// Check that the amount of stablecoins minted is positive
  stablecoin_minted_amount > 0
}


fn check_burn_negative(policy_id: PolicyId, self: Transaction) -> Bool{
  let stablecoin_minted_amount: Int =
      get_total_minted_stablecoin(self, policy_id)
  stablecoin_minted_amount < 0
}

fn check_burn_matches_datum(params: MintingParams, policy_id: PolicyId, self: Transaction){
  expect [collateral_input]: List<Output> =
    find_script_outputs(
      list.map(self.inputs, fn(i) { i.output }),
      params.collateral_validator,
    )
  let collateral_input_datum: CollateralDatum =
    get_collateral_datum(collateral_input)

  let stablecoin_minted_amount: Int =
      get_total_minted_stablecoin(self, policy_id)
  
  -collateral_input_datum.col_stablecoin_amount == stablecoin_minted_amount
}

fn check_owner_signature(params: MintingParams, self: Transaction){
  expect [collateral_input]: List<Output> =
    find_script_outputs(
      list.map(self.inputs, fn(i) { i.output }),
      params.collateral_validator,
    )
    // /// Parse collateral input datum
  let collateral_input_datum: CollateralDatum =
    get_collateral_datum(collateral_input)

  list.has(
    self.extra_signatories,
    collateral_input_datum.col_owner,
  )
}

fn get_oracle_rate(reference_inputs: List<Input>, oracle_val: ScriptHash) -> Int {
  // /// Filter all reference inputs to only the ones that come from the oracle script
  expect [oracle_input] =
    list.filter(
      reference_inputs,
      fn(i) {
        when i.output.address.payment_credential is {
          // /// If the input is from a script, save it if it's the oracle's one
          Script(script_hash) -> script_hash == oracle_val
          // /// If the input is from a PKH, drop it 
          _ -> False
        }
      },
    )
  // /// Get oracle's rate from the datum
  expect oracle_rate: Int =
    when oracle_input.output.datum is {
      NoDatum -> fail @"Couldn't find oracle's datum"
      DatumHash(_datum_hash) -> fail @"Oracle's datum is not inlined"
      InlineDatum(datum) -> datum
    }
  oracle_rate
}

fn get_collateral_datum(output: Output) -> CollateralDatum {
  expect output_datum: CollateralDatum =
    when output.datum is {
      NoDatum -> fail @"Collateral output datum is missing"
      DatumHash(_datum_hash) -> fail @"Collateral output datum is not inlined"
      InlineDatum(datum) -> datum
    }
  output_datum
}


/// Get the number (as Int) of the amount of tokens minted in this transaction.
pub fn get_total_minted_stablecoin(
  self: Transaction,
  policy_id: PolicyId,
) -> Int {
  quantity_of(self.mint, policy_id, stablecoin_token_name)
}

// /// max_mint calculates the maximum amount of stablecoins that can be minted with the given collateral.
//
// /// Oracle has ada price in USD cents [USD¢] ($1 is ¢100 in the oracle's datum). So rate needs to be divided by 100.
// /// Also, collateral_output_amount is in lovelaces [L], so final calculation needs to be divided by 1_000_000.
//
// /// ca = col_amount
// /// CMP = mp_collateral_min_percent
//
//
// ///                   ca [L]        rate [USD¢/ADA]                 ca [L]       
// ///              --------------- * ------------------           --------------- * rate [USD/ADA]
// ///                   CMP [%]        100 [USD¢/USD]                   CMP                         
// ///                 ---------                                               
// ///                   100 [%]                                               
// /// max_mint = ------------------------------------------- =  ------------------------------------- = [USD]
// ///                     1_000_000 [L/A]                                1_000_000 [L/A]
// /// 
fn max_mint(col_amount: Int, rate: Int, col_min_percent: Int) -> Int {
  col_amount / col_min_percent * rate / 1_000_000
}