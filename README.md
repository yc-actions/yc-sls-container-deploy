## GitHub Action to deploy Serverless Container to Yandex Cloud

Create a serverless container with the provided name if there is no one. Then deploy a new revision using the provided
image name and tag.

**Table of Contents**

<!-- toc -->

- [Usage](#usage)
- [Permissions](#permissions)
- [License Summary](#license-summary)

<!-- tocstop -->

## Usage

```yaml
- uses: actions/checkout@v4

- name: Get Yandex Cloud IAM token
  id: get-iam-token
  uses: docker://ghcr.io/yc-actions/yc-iam-token-fed:1.0.0
  with:
      yc-sa-id: aje***

- name: Login to Docker Hub
  uses: docker/login-action@v3
  with:
      registry: cr.yandex
      username: iam
      password: ${{ steps.get-iam-token.outputs.token }}

- name: Build, tag, and push image to Yandex Cloud Container Registry
  env:
      CR_REGISTRY: crp00000000000000000
      CR_REPOSITORY: my-cr-repo
      IMAGE_TAG: ${{ github.sha }}
  run: |
      docker build -t cr.yandex/$CR_REGISTRY/$CR_REPOSITORY:$IMAGE_TAG .
      docker push cr.yandex/$CR_REGISTRY/$CR_REPOSITORY:$IMAGE_TAG

- name: Deploy Serverless Container
  id: deploy-sls-container
  uses: yc-actions/yc-sls-container-deploy@v3
  with:
      yc-sa-id: aje***
      container-name: yc-action-demo
      folder-id: bbajn5q2d74c********
      revision-service-account-id: ajeqnasj95o7********
      revision-cores: 1
      revision-memory: 512Mb
      revision-core-fraction: 100
      revision-concurrency: 8
      revision-image-url: cr.yandex/crp00000000000000000/my-cr-repo:${{ github.sha }}
      revision-execution-timeout: 10

      # You can also specify $latest as a secret versionId to use the current version of the secret
      revision-secrets: |
          VARIABLE_NAME=SECRET_ID/e6qru0q3lo914*******/KEY
```

One of `yc-sa-json-credentials`, `yc-iam-token` or `yc-sa-id` should be provided depending on the authentication method
you want to use. The action will use the first one it finds.

- `yc-sa-json-credentials` should contain JSON with authorized key for Service Account. More info in
  [Yandex Cloud IAM documentation](https://yandex.cloud/en/docs/iam/operations/authentication/manage-authorized-keys#cli_1).
- `yc-iam-token` should contain IAM token. It can be obtained using `yc iam create-token` command or using
  [yc-actions/yc-iam-token-fed](https://github.com/yc-actions/yc-iam-token-fed)

```yaml
- name: Get Yandex Cloud IAM token
  id: get-iam-token
  uses: docker://ghcr.io/yc-actions/yc-iam-token-fed:1.0.0
  with:
      yc-sa-id: aje***
```

- `yc-sa-id` should contain Service Account ID. It can be obtained using `yc iam service-accounts list` command. It is
  used to exchange GitHub token for IAM token using Workload Identity Federation. More info in
  [Yandex Cloud IAM documentation](https://yandex.cloud/ru/docs/iam/concepts/workload-identity).

See [action.yml](action.yml) for the full documentation for this action's inputs and outputs.

## Permissions

### Deploy time permissions

To perform this action, the service account on behalf of which we are acting must have the
`serverless-containers.editor` role or higher.

Additionally, you may need to grant the following optional roles depending on your specific needs:

| Optional Role                 | Required For                                                                                                                     |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `iam.serviceAccounts.user`    | Providing the service account ID in parameters, ensuring access to the service account                                           |
| `vpc.user`                    | Deploying the container in a VPC with a specified network ID                                                                     |
| `serverless-containers.admin` | Making the container public                                                                                                      |
| `functions.editor`            | If you are using **secrets**. `serverless-containers.editor` missing some permissions, so you have to use this one additionnaly. |

### Runtime permissions

The service account provided to container via `revision-service-account-id` parameter must have the following roles:

| Required Role                 | Required For                                                        |
| ----------------------------- | ------------------------------------------------------------------- |
| `storage.viewer`              | To mount the bucket to the container in read only mode.             |
| `storage.editor`              | To mount the bucket to the container in read-write mode.            |
| `lockbox.payloadViewer`       | To access the Lockbox secrets.                                      |
| `kms.keys.encrypterDecrypter` | To decrypt the Lockbox secrets, if they are encrypted with KMS key. |

## License Summary

This code is made available under the MIT license.
