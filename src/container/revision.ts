/**
 * Container revision deployment.
 *
 * @module
 */

import { error } from '@actions/core'
import { Session, waitForOperation } from '@yandex-cloud/nodejs-sdk'
import { containerService } from '@yandex-cloud/nodejs-sdk/serverless-containers-v1'
import { Revision } from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/serverless/containers/v1/container'
import { DeployContainerRevisionRequest } from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/serverless/containers/v1/container_service'

import { ActionInputs } from '../action-inputs.js'

type DeepPartial<T> = T extends object ? { [P in keyof T]?: DeepPartial<T[P]> } : T

/**
 * Deploys a new revision of the container.
 *
 * @param session - Authenticated Yandex Cloud SDK session
 * @param containerId - Target container ID
 * @param revisionInputs - Parsed action inputs
 * @returns The created revision
 * @throws {Error} If the deploy operation returns no response
 */
export const deployRevision = async (
    session: Session,
    containerId: string,
    revisionInputs: ActionInputs
): Promise<Revision> => {
    const client = session.client(containerService.ContainerServiceClient)
    const req = {
        containerId,
        resources: {
            memory: revisionInputs.memory,
            cores: revisionInputs.cores,
            coreFraction: revisionInputs.coreFraction
        },
        executionTimeout: { seconds: revisionInputs.executionTimeout },
        serviceAccountId: revisionInputs.serviceAccountId,
        imageSpec: {
            imageUrl: revisionInputs.imageUrl,
            command: revisionInputs.command,
            args: revisionInputs.args,
            environment: revisionInputs.environment,
            workingDir: revisionInputs.workingDir
        },
        concurrency: revisionInputs.concurrency,
        secrets: revisionInputs.secrets,
        logOptions: revisionInputs.logOptions,
        mounts: revisionInputs.mounts,
        runtime: revisionInputs.runtime === 'http' ? { http: {} } : { task: {} }
    } as DeepPartial<DeployContainerRevisionRequest>

    if (revisionInputs.networkId !== '') {
        req.connectivity = { networkId: revisionInputs.networkId, subnetIds: [] }
    }
    if (revisionInputs.provisioned !== undefined) {
        req.provisionPolicy = { minInstances: revisionInputs.provisioned }
    }

    const scalingPolicy: { zoneInstancesLimit?: number; zoneRequestsLimit?: number } = {}

    if (revisionInputs.zoneInstancesLimit !== undefined) {
        scalingPolicy.zoneInstancesLimit = revisionInputs.zoneInstancesLimit
    }
    if (revisionInputs.zoneRequestsLimit !== undefined) {
        scalingPolicy.zoneRequestsLimit = revisionInputs.zoneRequestsLimit
    }

    if (Object.keys(scalingPolicy).length > 0) {
        req.scalingPolicy = scalingPolicy
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const revisionDeployOperation = await client.deployRevision(DeployContainerRevisionRequest.fromPartial(req as any))

    const operation = await waitForOperation(revisionDeployOperation, session)

    if (operation.response) {
        return Revision.decode(operation.response.value)
    }
    error('failed to create revision')
    throw new Error('failed to create revision')
}
