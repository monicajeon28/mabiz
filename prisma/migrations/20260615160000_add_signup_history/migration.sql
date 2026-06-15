-- AddColumn: ContactGroupMember.joinedAt
ALTER TABLE "ContactGroupMember" ADD COLUMN "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AddIndex: ContactGroupMember(groupId, joinedAt)
CREATE INDEX "idx_group_joined" ON "ContactGroupMember"("groupId" DESC, "joinedAt" DESC);

-- AddColumn: Contact.signupCount
ALTER TABLE "Contact" ADD COLUMN "signupCount" INTEGER NOT NULL DEFAULT 1;

-- AddColumn: Contact.signupHistory
ALTER TABLE "Contact" ADD COLUMN "signupHistory" JSONB DEFAULT '[]';

-- AddIndex: Contact(organizationId, signupCount) for re-signup tracking
CREATE INDEX "idx_contact_recontact" ON "Contact"("organizationId" DESC, "signupCount" DESC);
