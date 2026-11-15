import { CfnOutput, Duration, Stack, type StackProps } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import type { Construct } from 'constructs';

export interface GithubDeployStackProps extends StackProps {
  /** owner/repo, e.g. shubhamzxv/DevGuru */
  githubRepo: string;
  /** The Amplify app `npm run deploy` publishes to (deploy.config.json → appId). */
  amplifyAppId: string;
  /** An account can have only one GitHub OIDC provider. If it exists, pass its ARN. */
  existingOidcProviderArn?: string;
}

/**
 * Role that the GitHub Actions "Deploy" workflow assumes with OIDC (no stored AWS keys).
 * Only the "production" environment of this repository can assume it, and it may only
 * publish to the one Amplify app.
 */
export class GithubDeployStack extends Stack {
  constructor(scope: Construct, id: string, props: GithubDeployStackProps) {
    super(scope, id, props);

    const provider = props.existingOidcProviderArn
      ? iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
          this,
          'GithubOidc',
          props.existingOidcProviderArn,
        )
      : new iam.OpenIdConnectProvider(this, 'GithubOidc', {
          url: 'https://token.actions.githubusercontent.com',
          clientIds: ['sts.amazonaws.com'],
        });

    const role = new iam.Role(this, 'DeployRole', {
      description: `GitHub Actions deploy for ${props.githubRepo}`,
      maxSessionDuration: Duration.hours(1),
      assumedBy: new iam.WebIdentityPrincipal(provider.openIdConnectProviderArn, {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          // deploy.yml runs in the "production" environment.
          'token.actions.githubusercontent.com:sub': `repo:${props.githubRepo}:environment:production`,
        },
      }),
    });

    const app = `arn:aws:amplify:${this.region}:${this.account}:apps/${props.amplifyAppId}`;
    // Exactly the calls scripts/deploy.mjs makes for an existing app.
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'amplify:GetApp',
          'amplify:UpdateApp',
          'amplify:GetBranch',
          'amplify:CreateBranch',
          'amplify:CreateDeployment',
          'amplify:StartDeployment',
          'amplify:GetJob',
        ],
        resources: [app, `${app}/*`],
      }),
    );

    new CfnOutput(this, 'DeployRoleArn', {
      value: role.roleArn,
      description:
        'Put this in GitHub → Settings → Secrets and variables → Actions → Variables as AWS_DEPLOY_ROLE_ARN',
    });
  }
}
