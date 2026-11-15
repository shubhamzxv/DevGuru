#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { GithubDeployStack } from '../lib/github-deploy-stack';
import { SiteStack } from '../lib/site-stack';

// Settings live in cdk.json → "context" (or pass -c key=value on the command line).
const app = new App();
const context = (key: string) => (app.node.tryGetContext(key) as string | undefined) || undefined;
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: context('region') ?? process.env.CDK_DEFAULT_REGION,
};

// Role for the GitHub Actions deploy workflow (Amplify Hosting).
new GithubDeployStack(app, 'DevGuruGithubDeploy', {
  env,
  githubRepo: context('githubRepo') ?? 'shubhamzxv/DevGuru',
  amplifyAppId: context('amplifyAppId') ?? '',
  existingOidcProviderArn: context('githubOidcProviderArn'),
});

// Optional: host on S3 + CloudFront instead of Amplify.
new SiteStack(app, 'DevGuruSite', {
  env,
  domainName: context('domainName'),
  certificateArn: context('certificateArn'),
});
