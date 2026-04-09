import { JobState } from '@vendure/common/lib/generated-types';
import { DeepPartial } from '@vendure/common/lib/shared-types';
import { Column, Entity, Index } from 'typeorm';

import { VendureEntity } from '../../entity/base/base.entity';

// createdAt is coming from base entity VendureEntity and is not explicitly defined here
@Index(['createdAt'])
// Composite index used by the rate-limit COUNT query in SqlJobQueueStrategy.
// That query runs on every poll for every rate-limited queue, so an index
// is necessary once the job_record table grows.
@Index(['queueName', 'startedAt'])
@Entity()
export class JobRecord extends VendureEntity {
    constructor(input: DeepPartial<JobRecord>) {
        super(input);
    }

    @Column()
    queueName: string;

    @Column('simple-json', { nullable: true })
    data: any;

    @Column('varchar')
    state: JobState;

    @Column()
    progress: number;

    @Column('simple-json', { nullable: true })
    result: any;

    @Column({ nullable: true })
    error: string;

    @Column({ nullable: true, precision: 6 })
    startedAt?: Date;

    @Column({ nullable: true, precision: 6 })
    settledAt?: Date;

    @Column()
    isSettled: boolean;

    @Column()
    retries: number;

    @Column()
    attempts: number;
}
