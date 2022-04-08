import * as core from '@actions/core';
import * as github from '@actions/github';
import { IIAmCredentials } from '@yandex-cloud/nodejs-sdk/dist/types';
import {
    serviceClients,
    Session,
    waitForOperation,
    decodeMessage,
} from '@yandex-cloud/nodejs-sdk';

import {
    ListContainersResponse,
    ListContainersRequest,
    CreateContainerRequest,
    DeployContainerRevisionRequest,
} from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/serverless/containers/v1/container_service';
import {
    Container,
    Revision,
} from '@yandex-cloud/nodejs-sdk/dist/generated/yandex/cloud/serverless/containers/v1/container';
import { parseMemory } from './memory';

const findContainerByName = async (
    session: Session,
    folderId: string,
    containerName: string,
): Promise<ListContainersResponse> => {
    const client = session.client(serviceClients.ContainerServiceClient);

    return client.list(
        ListContainersRequest.fromPartial({
            pageSize: 100,
            folderId,
            filter: `name = "${containerName}"`,
        }),
    );
};

const createContainer = async (
    session: Session,
    folderId: string,
    containerName: string,
): Promise<Container> => {
    const { repo } = github.context;
    const client = session.client(serviceClients.ContainerServiceClient);
    const containerCreateOperation = await client.create(
        CreateContainerRequest.fromPartial({
            folderId,
            name: containerName,
            description: `Created from: ${repo.owner}/${repo.repo}`,
        }),
    );
    const operation = await waitForOperation(containerCreateOperation, session);

    if (operation.response) {
        return decodeMessage<Container>(operation.response);
    }
    core.error('failed to create container');
    throw new Error('failed to create container');
};

const createRevision = async (
    session: Session,
    containerId: string,
    revisionInputs: IRevisionInputs,
): Promise<Revision> => {
    const client = session.client(serviceClients.ContainerServiceClient);

    const revisionDeployOperation = await client.deployRevision(
        DeployContainerRevisionRequest.fromPartial({
            containerId,
            resources: {
                memory: revisionInputs.memory,
                cores: revisionInputs.cores,
                coreFraction: revisionInputs.coreFraction,
            },
            executionTimeout: { seconds: revisionInputs.executionTimeout },
            serviceAccountId: revisionInputs.serviceAccountId,
            imageSpec: {
                imageUrl: revisionInputs.imageUrl,
                command: revisionInputs.command,
                args: revisionInputs.args,
                environment: revisionInputs.environment,
                workingDir: revisionInputs.workingDir,
            },
            concurrency: revisionInputs.concurrency,
        }),
    );

    const operation = await waitForOperation(revisionDeployOperation, session);

    if (operation.response) {
        return decodeMessage<Revision>(operation.response);
    }
    core.error('failed to create revision');
    throw new Error('failed to create revision');
};

interface IRevisionInputs {
    imageUrl: string;
    workingDir: string;
    serviceAccountId: string;
    cores: number;
    memory: number;
    coreFraction: number;
    concurrency: number;
    executionTimeout: number;
    command: { command: string[] } | undefined;
    args: { args: string[] } | undefined;
    environment: { [key: string]: string };
}

const parseRevisionInputs = (): IRevisionInputs => {
    const imageUrl: string = core.getInput('revision-image-url');
    const workingDir: string = core.getInput('revision-working-dir');
    const serviceAccountId: string = core.getInput('revision-service-account-id');
    const cores: number = Number.parseInt(core.getInput('revision-cores') || '1', 10);
    const memory: number = parseMemory(
        core.getInput('revision-memory') || '128Mb',
    );
    const coreFraction: number = Number.parseInt(
        core.getInput('revision-core-fraction') || '100',
        10,
    );
    const concurrency: number = Number.parseInt(
        core.getInput('revision-concurrency') || '1',
        10,
    );
    const executionTimeout: number = Number.parseInt(
        core.getInput('revision-execution-timeout') || '3',
        10,
    );
    const commands: string[] = core.getMultilineInput('revision-commands');

    const command = commands.length > 0 ? { command: commands } : undefined;
    const argList: string[] = core.getMultilineInput('revision-args');

    const args = argList.length > 0 ? { args: argList } : undefined;
    const env: string[] = core.getMultilineInput('revision-env');
    const environment: { [key: string]: string } = {};

    for (const line of env) {
        const [key, value] = line.split('=');

        environment[key?.trim()] = value?.trim();
    }
    core.setOutput('id', containerId)

    return {
        imageUrl,
        workingDir,
        serviceAccountId,
        cores,
        memory,
        coreFraction,
        concurrency,
        executionTimeout,
        command,
        args,
        environment,
    };
};

const run = async (): Promise<void> => {
    try {
        core.info('start');
        const ycSaJsonCredentials = core.getInput('yc-sa-json-credentials', {
            required: true,
        });

        const folderId: string = core.getInput('folder-id', {
            required: true,
        });
        const containerName: string = core.getInput('container-name', {
            required: true,
        });
        const revisionInputs = parseRevisionInputs();

        core.info(`Folder ID: ${folderId}, container name: ${containerName}`);

        const serviceAccountJson = JSON.parse(
            ycSaJsonCredentials,
        ) as IIAmCredentials;
        const session = new Session({ serviceAccountJson });

        const containersResponse = await findContainerByName(
            session,
            folderId,
            containerName,
        );
        let containerId: string;

        if (containersResponse.containers.length > 0) {
            containerId = containersResponse.containers[0].id;
            core.info(
                `Container with name: ${containerName} already exists and has id: ${containerId}`,
            );
        } else {
            core.info(
                `There is no container with name: ${containerName}. Creating a new one.`,
            );
            const resp = await createContainer(
                session,
                folderId,
                containerName,
            );

            containerId = resp.id;
            core.info(`Container successfully created. Id: ${containerId}`);
        }

        core.info('Creating new revision.');
        const rev = await createRevision(
            session,
            containerId,
            revisionInputs,
        );

        core.info(`Revision created. Id: ${rev.id}`);

        core.setOutput('rev', rev.id);
    } catch (error) {
        if (error instanceof Error) {
            core.error(error);
            core.setFailed(error.message);
        }
    }
};

run();
