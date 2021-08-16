import {MigrationInterface, QueryRunner} from "typeorm";

export class Create1625390380490 implements MigrationInterface {
    name = 'Create1625390380490'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "refresh_token" ("token" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "expires_at" TIMESTAMP NOT NULL, "user_id" uuid, CONSTRAINT "PK_c31d0a2f38e6e99110df62ab0af" PRIMARY KEY ("token"))`);
        await queryRunner.query(`CREATE INDEX "IDX_6bbe63d2fe75e7f0ba1710351d" ON "refresh_token" ("user_id") `);
        await queryRunner.query(`CREATE TABLE "user" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "disabled_at" TIMESTAMP, "full_name" character varying(100) NOT NULL, "phone_number" bigint NOT NULL, "email_address" character varying(255), "password" character varying(128) NOT NULL, "notify" json NOT NULL, "last_login_date" TIMESTAMP, "created_by_method" character varying(24) NOT NULL, "last_used_team_id" uuid, CONSTRAINT "UQ_01eea41349b6c9275aec646eee0" UNIQUE ("phone_number"), CONSTRAINT "REL_d5b47ea7cbdf08145a07a21f14" UNIQUE ("last_used_team_id"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "team_member" ("added_at" TIMESTAMP NOT NULL DEFAULT now(), "added_by" uuid, "scopes" character varying(32) array NOT NULL, "team_id" uuid NOT NULL, "user_id" uuid NOT NULL, CONSTRAINT "PK_34169355c6d1744228f5bb75549" PRIMARY KEY ("team_id", "user_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_dc3bc4d7ed963526d5dadc3b56" ON "team_member" ("scopes") `);
        await queryRunner.query(`CREATE TABLE "team" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "is_admin" boolean NOT NULL DEFAULT false, "metadata" jsonb NOT NULL, "name" character varying(64) NOT NULL, "creator_id" uuid, CONSTRAINT "PK_f57d8293406df4af348402e4b74" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "invite_link" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "expires_at" TIMESTAMP NOT NULL, "scopes" character varying(32) array NOT NULL, "team_id" uuid, "user_id" uuid, CONSTRAINT "PK_2baa9c7c5811e4143fa5d4c7b88" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1c5c3b4cdbe39514d0257e4e6b" ON "invite_link" ("team_id") `);
        await queryRunner.query(`CREATE TABLE "otp" ("phone_number" bigint NOT NULL, "otp" integer NOT NULL, "expires_at" TIMESTAMP NOT NULL, "resends_left" integer NOT NULL, CONSTRAINT "PK_a354bd2e03b9638a30904168f6a" PRIMARY KEY ("phone_number"))`);
        await queryRunner.query(`CREATE INDEX "IDX_0ff01343154ec14e84bed53d1f" ON "otp" ("otp") `);
        await queryRunner.query(`ALTER TABLE "refresh_token" ADD CONSTRAINT "FK_6bbe63d2fe75e7f0ba1710351d4" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "FK_d5b47ea7cbdf08145a07a21f14a" FOREIGN KEY ("last_used_team_id") REFERENCES "team"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "team_member" ADD CONSTRAINT "FK_a1b5b4f5fa1b7f890d0a278748b" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE RESTRICT`);
        await queryRunner.query(`ALTER TABLE "team_member" ADD CONSTRAINT "FK_0724b86622f89c433dee4cd8b17" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "team" ADD CONSTRAINT "FK_41397c85ba7b68f31beee207854" FOREIGN KEY ("creator_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "invite_link" ADD CONSTRAINT "FK_1c5c3b4cdbe39514d0257e4e6bc" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "invite_link" ADD CONSTRAINT "FK_674482f4a1fb4db5475845f6caf" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "invite_link" DROP CONSTRAINT "FK_674482f4a1fb4db5475845f6caf"`);
        await queryRunner.query(`ALTER TABLE "invite_link" DROP CONSTRAINT "FK_1c5c3b4cdbe39514d0257e4e6bc"`);
        await queryRunner.query(`ALTER TABLE "team" DROP CONSTRAINT "FK_41397c85ba7b68f31beee207854"`);
        await queryRunner.query(`ALTER TABLE "team_member" DROP CONSTRAINT "FK_0724b86622f89c433dee4cd8b17"`);
        await queryRunner.query(`ALTER TABLE "team_member" DROP CONSTRAINT "FK_a1b5b4f5fa1b7f890d0a278748b"`);
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_d5b47ea7cbdf08145a07a21f14a"`);
        await queryRunner.query(`ALTER TABLE "refresh_token" DROP CONSTRAINT "FK_6bbe63d2fe75e7f0ba1710351d4"`);
        await queryRunner.query(`DROP INDEX "IDX_0ff01343154ec14e84bed53d1f"`);
        await queryRunner.query(`DROP TABLE "otp"`);
        await queryRunner.query(`DROP INDEX "IDX_1c5c3b4cdbe39514d0257e4e6b"`);
        await queryRunner.query(`DROP TABLE "invite_link"`);
        await queryRunner.query(`DROP TABLE "team"`);
        await queryRunner.query(`DROP INDEX "IDX_dc3bc4d7ed963526d5dadc3b56"`);
        await queryRunner.query(`DROP TABLE "team_member"`);
        await queryRunner.query(`DROP TABLE "user"`);
        await queryRunner.query(`DROP INDEX "IDX_6bbe63d2fe75e7f0ba1710351d"`);
        await queryRunner.query(`DROP TABLE "refresh_token"`);
    }

}
