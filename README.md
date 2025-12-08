## GitHub Action to deploy Serverless Container to Yandex Cloud

Create a serverless container with the provided name if there is no one. Then deploy a new revision using the provided
image name and tag.

**Table of Contents**

<!-- toc -->

- [Usage](#usage)
- [Secrets](#secrets)
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
      uses: yc-actions/yc-sls-container-deploy@v4
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
```

One of `yc-sa-json-credentials`, `yc-iam-token` or `yc-sa-id` should be provided depending on the authentication method you
want to use. The action will use the first one it finds.
* `yc-sa-json-credentials` should contain JSON with authorized key for Service Account. More info
  in [Yandex Cloud IAM documentation](https://yandex.cloud/en/docs/iam/operations/authentication/manage-authorized-keys#cli_1).
* `yc-iam-token` should contain IAM token. It can be obtained using `yc iam create-token` command or using
  [yc-actions/yc-iam-token-fed](https://github.com/yc-actions/yc-iam-token-fed)
```yaml
      - name: Get Yandex Cloud IAM token
        id: get-iam-token
        uses: docker://ghcr.io/yc-actions/yc-iam-token-fed:1.0.0
        with:
          yc-sa-id: aje***
```
* `yc-sa-id` should contain Service Account ID. It can be obtained using `yc iam service-accounts list` command. It is
  used to exchange GitHub token for IAM token using Workload Identity Federation. More info in [Yandex Cloud IAM documentation](https://yandex.cloud/ru/docs/iam/concepts/workload-identity).


See [action.yml](action.yml) for the full documentation for this action's inputs and outputs.

### Ephemeral disk mounts (Preview)

You can mount ephemeral disks to your Serverless Container to store temporary data larger than the `/tmp` limit.

Add `revision-ephemeral-mounts` with one or more lines using the format `MOUNT_PATH:SIZE[:ACCESS_MODE]`:

```yaml
    - name: Deploy Serverless Container
      id: deploy-sls-container
      uses: yc-actions/yc-sls-container-deploy@v4
      with:
        # ... other parameters ...
        revision-ephemeral-mounts: |
          /app/tmp:5Gb:rw
```

Notes:
- SIZE accepts values like `512Mb` or `5Gb`.
- ACCESS_MODE is optional; defaults to read-write. Allowed values mirror storage mounts: `read-only|ro|readOnly|read_only|ReadOnly|read-write|rw|readWrite|read_write|ReadWrite`.
- The mount path must be an empty directory inside the container image.
- Feature availability and limits are described in Yandex Cloud docs: [Mount ephemeral storage](https://yandex.cloud/en/docs/serverless-containers/concepts/mounting#mount-ephemeral-storage).

## Secrets

The action supports Yandex Cloud Lockbox secrets integration. You can specify secrets using the `revision-secrets` input parameter.

### Secret Format

Secrets should be specified in the following format:
```
environmentVariable=secretId/versionId/key
```

Where:
- `environmentVariable` - the name of the environment variable that will be available in the container
- `secretId` - the ID of the Lockbox secret
- `versionId` - the version ID of the secret (use `latest` to automatically resolve to the current version)
- `key` - the key within the secret payload

**Note**: Lines starting with `#` are treated as comments and will be ignored. You can also add inline comments after the secret definition using `#`.

### Usage Examples

#### Basic Secret Usage
```yaml
    - name: Deploy Serverless Container
      uses: yc-actions/yc-sls-container-deploy@v4
      with:
        # ... other parameters ...
        revision-secrets: |
          DATABASE_URL=secret123/version1/DATABASE_URL
          API_KEY=secret456/latest/API_KEY
```

#### Multiple Secrets with Different Versions
```yaml
    - name: Deploy Serverless Container
      uses: yc-actions/yc-sls-container-deploy@v4
      with:
        # ... other parameters ...
        revision-secrets: |
          DATABASE_URL_LATEST=secret123/latest/DATABASE_URL
          DATABASE_URL_STABLE=secret123/version2/DATABASE_URL
          API_KEY_LATEST=secret456/latest/API_KEY
          API_KEY_STABLE=secret456/version5/API_KEY
```

#### Same Key with Different Environment Variables
You can use the same secret key with different versions and map them to different environment variables:

```yaml
    - name: Deploy Serverless Container
      uses: yc-actions/yc-sls-container-deploy@v4
      with:
        # ... other parameters ...
        revision-secrets: |
          # Latest version for development
          DATABASE_URL_DEV=secret123/latest/DATABASE_URL
          # Stable version for production
          DATABASE_URL_PROD=secret123/version2/DATABASE_URL
          # Latest API key
          API_KEY_LATEST=secret456/latest/API_KEY
          # Specific version API key
          API_KEY_STABLE=secret456/version5/API_KEY
```

#### Using Comments
You can add comments to document your secrets:

```yaml
    - name: Deploy Serverless Container
      uses: yc-actions/yc-sls-container-deploy@v4
      with:
        # ... other parameters ...
        revision-secrets: |
          # Database configuration
          DATABASE_URL=secret123/latest/DATABASE_URL # Latest database URL
          API_KEY=secret456/version2/API_KEY  # Stable API key
          
          # Redis connection
          REDIS_URL=secret789/latest/REDIS_URL # Redis connection string
          
          # JWT configuration
          JWT_SECRET=secret999/version5/JWT_SECRET  # JWT signing key
```

### Latest Version Resolution

When you specify `latest` as the version ID, the action will automatically resolve it to the current version of the secret by querying the Lockbox API. This ensures you always get the most up-to-date version without manually updating version IDs.

### Concurrency Control

The action uses concurrency limiting (5 concurrent requests) when resolving "latest" versions to avoid overwhelming the Lockbox API.

## Permissions

### Deploy time permissions

To perform this action, the service account on behalf of which we are acting must have
the `serverless-containers.editor` role or higher.

Additionally, you may need to grant the following optional roles depending on your specific needs:

| Optional Role                 | Required For                                                                           |
|-------------------------------|----------------------------------------------------------------------------------------|
| `iam.serviceAccounts.user`    | Providing the service account ID in parameters, ensuring access to the service account |
| `vpc.user`                    | Deploying the container in a VPC with a specified network ID                           |
| `serverless-containers.admin` | Making the container public                                                            |
| `functions.editor`            | If you are using **secrets**. `serverless-containers.editor` missing some permissions, so you have to use this one additionnaly. |
| `lockbox.viewer`       | To access Lockbox secrets during deployment. Required for secret resolution.           |

### Runtime permissions

The service account provided to container via `revision-service-account-id` parameter must have the following roles:

| Required Role                 | Required For                                                        |
|-------------------------------|---------------------------------------------------------------------|
| `storage.viewer`              | To mount the bucket to the container in read only mode.             |
| `storage.editor`              | To mount the bucket to the container in read-write mode.            |
| `lockbox.payloadViewer`       | To access the Lockbox secrets.                                      |
| `kms.keys.encrypterDecrypter` | To decrypt the Lockbox secrets, if they are encrypted with KMS key. |

## License Summary

This code is made available under the MIT license.
