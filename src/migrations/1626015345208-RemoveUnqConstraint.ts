import {MigrationInterface, QueryRunner} from "typeorm";

export class RemoveUnqConstraint1626015345208 implements MigrationInterface {
    name = 'RemoveUnqConstraint1626015345208'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_d5b47ea7cbdf08145a07a21f14a"`);
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "REL_d5b47ea7cbdf08145a07a21f14"`);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "FK_d5b47ea7cbdf08145a07a21f14a" FOREIGN KEY ("last_used_team_id") REFERENCES "team"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_d5b47ea7cbdf08145a07a21f14a"`);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "REL_d5b47ea7cbdf08145a07a21f14" UNIQUE ("last_used_team_id")`);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "FK_d5b47ea7cbdf08145a07a21f14a" FOREIGN KEY ("last_used_team_id") REFERENCES "team"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
