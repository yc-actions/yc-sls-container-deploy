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
    - name: Login to Yandex Cloud Container Registry
      id: login-cr
      uses: yc-actions/yc-cr-login@v2
      with:
        yc-sa-json-credentials: ${{ secrets.YC_SA_JSON_CREDENTIALS }}

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
      uses: yc-actions/yc-sls-container-deploy@v2
      with:
        yc-sa-json-credentials: ${{ secrets.YC_SA_JSON_CREDENTIALS }}
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

See [action.yml](action.yml) for the full documentation for this action's inputs and outputs.

## Permissions

To perform this action, it is required that the service account on behalf of which we are acting has granted the
`serverless.containers.editor` role or greater.

Optionally you may need to grant `iam.serviceAccounts.user` role if you provide the service account ID in params, so 
the container service could assure that you have access to the service account.

## License Summary

This code is made available under the MIT license.
