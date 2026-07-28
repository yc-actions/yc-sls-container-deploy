/**
 * Container access bindings.
 *
 * @module
 */

import { Session } from '@yandex-cloud/nodejs-sdk'
import { containerService } from '@yandex-cloud/nodejs-sdk/serverless-containers-v1'
import { SetAccessBindingsRequest } from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/access/access'

/**
 * Grants `allUsers` the container invoker role, making it publicly callable.
 *
 * @param session - Authenticated Yandex Cloud SDK session
 * @param containerId - Target container ID
 */
export const makeContainerPublic = async (session: Session, containerId: string): Promise<void> => {
    const client = session.client(containerService.ContainerServiceClient)

    await client.setAccessBindings(
        SetAccessBindingsRequest.fromPartial({
            resourceId: containerId,
            accessBindings: [
                {
                    roleId: 'serverless.containers.invoker',
                    subject: {
                        id: 'allUsers',
                        type: 'system'
                    }
                }
            ]
        })
    )
}
