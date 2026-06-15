-- Add inputFields to ContractTemplate (field definitions)
ALTER TABLE "ContractTemplate" ADD COLUMN "inputFields" JSONB NOT NULL DEFAULT '[]';

-- Add inputFields to ContractInstance (collected field data from signing)
ALTER TABLE "ContractInstance" ADD COLUMN "inputFields" JSONB NOT NULL DEFAULT '[]';

-- Index for efficient queries
CREATE INDEX idx_contract_template_has_input_fields ON "ContractTemplate"((inputFields IS NOT NULL AND inputFields <> '[]'::jsonb));
CREATE INDEX idx_contract_instance_has_input_fields ON "ContractInstance"((inputFields IS NOT NULL AND inputFields <> '[]'::jsonb));
