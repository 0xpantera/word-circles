# Contract deployment and verification for Gnosis chain.
#
# Deploy:
#   DEPLOYER_PRIVATE_KEY — private key for the deployer (owner) account
#   RESOLVER_ADDRESS     — resolver wallet address (derived from RESOLVER_PRIVATE_KEY)
#   RPC_URL              — Gnosis RPC endpoint
#
# Verify (after deployment):
#   GNOSISSCAN_API_KEY   — API key from gnosisscan.io
#   DEPLOYER_ADDRESS     — deployer wallet address (owner of Stats + Commitment)
#   RESOLVER_ADDRESS     — resolver wallet address
#   ESCROW_ADDRESS       — deployed WordCirclesEscrow address
#   STATS_ADDRESS        — deployed WordCircleStats address
#   COMMITMENT_ADDRESS   — deployed WordCommitment address

.PHONY: deploy verify-all

deploy:
	forge script script/Deploy.s.sol:DeployScript \
		--rpc-url $(RPC_URL) \
		--private-key $(DEPLOYER_PRIVATE_KEY) \
		--broadcast

verify-all:
	@echo "Verifying contracts on Gnosisscan..."
	forge verify-contract $(ESCROW_ADDRESS) contracts/WordCirclesEscrow.sol:WordCirclesEscrow \
		--chain 100 --watch
	forge verify-contract $(STATS_ADDRESS) contracts/WordCircleStats.sol:WordCircleStats \
		--chain 100 --watch \
		--constructor-args $$(cast abi-encode "constructor(address,address)" $(DEPLOYER_ADDRESS) $(RESOLVER_ADDRESS))
	forge verify-contract $(COMMITMENT_ADDRESS) contracts/WordCommitment.sol:WordCommitment \
		--chain 100 --watch \
		--constructor-args $$(cast abi-encode "constructor(address,address,bytes32,string)" \
			$(DEPLOYER_ADDRESS) $(RESOLVER_ADDRESS) \
			0xed01643704d9284f12c5b5fb16717cffa1a2cf4ed0cc01ac6274bc63df2b266a \
			"ipfs://QmWaw2pGNQJqQmyWTeoaAJcMygUdSj69Dxq8v422HjmPBa")
