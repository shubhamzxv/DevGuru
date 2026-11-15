import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import type { Construct } from 'constructs';
import { distDir, siteHeaders, spaRewriteFunctionCode } from './hosting-config';

export interface SiteStackProps extends StackProps {
  /** Optional custom domain, e.g. devguru.example.com. Needs certificateArn too. */
  domainName?: string;
  /** ACM certificate in us-east-1 covering domainName (CloudFront only uses us-east-1). */
  certificateArn?: string;
}

/**
 * Alternative to Amplify Hosting: private S3 bucket + CloudFront.
 * Same security headers (customHttp.yml) and SPA rule (amplify-rules.json).
 * Run `npm run build` in the project root first; this uploads ../dist.
 */
export class SiteStack extends Stack {
  constructor(scope: Construct, id: string, props: SiteStackProps = {}) {
    super(scope, id, props);

    const bucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const headers = siteHeaders();
    const sts = /max-age=(\d+)/.exec(headers['Strict-Transport-Security'] ?? '')?.[1];
    const securityHeaders: cloudfront.ResponseSecurityHeadersBehavior = {
      contentSecurityPolicy: {
        contentSecurityPolicy: headers['Content-Security-Policy'] ?? "default-src 'self'",
        override: true,
      },
      strictTransportSecurity: {
        accessControlMaxAge: Duration.seconds(Number(sts ?? 31536000)),
        includeSubdomains: true,
        override: true,
      },
      contentTypeOptions: { override: true },
      frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
      referrerPolicy: {
        referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
        override: true,
      },
    };
    // Headers CloudFront has no typed setting for (Permissions-Policy, COOP) go here.
    const handled = new Set([
      'Content-Security-Policy',
      'Strict-Transport-Security',
      'X-Content-Type-Options',
      'X-Frame-Options',
      'Referrer-Policy',
    ]);
    const customHeaders = Object.entries(headers)
      .filter(([key]) => !handled.has(key))
      .map(([header, value]) => ({ header, value, override: true }));

    const responseHeaders = new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeaders', {
      comment: 'DevGuru security headers (from customHttp.yml)',
      securityHeadersBehavior: securityHeaders,
      customHeadersBehavior: customHeaders.length ? { customHeaders } : undefined,
    });

    const spaRewrite = new cloudfront.Function(this, 'SpaRewrite', {
      comment: 'App routes → /index.html (from amplify-rules.json)',
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(spaRewriteFunctionCode()),
    });

    const certificate = props.certificateArn
      ? acm.Certificate.fromCertificateArn(this, 'Certificate', props.certificateArn)
      : undefined;

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: 'DevGuru',
      defaultRootObject: 'index.html',
      // Edge locations in India are included from PriceClass 200 upwards.
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      // Only applies with a custom certificate (the default *.cloudfront.net one is fixed by AWS).
      minimumProtocolVersion: certificate
        ? cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021
        : undefined,
      domainNames: props.domainName && certificate ? [props.domainName] : undefined,
      certificate,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        // Follows each file's Cache-Control (set below): hashed assets for a year, the rest no-cache.
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: responseHeaders,
        compress: true,
        functionAssociations: [
          { function: spaRewrite, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST },
        ],
      },
    });

    // 1) Hashed files: cache for a year. 2) Everything else (index.html, sw.js, manifest...): always revalidate.
    const assets = new s3deploy.BucketDeployment(this, 'DeployAssets', {
      destinationBucket: bucket,
      sources: [s3deploy.Source.asset(distDir, { exclude: ['*', '!assets', '!assets/**'] })],
      cacheControl: [s3deploy.CacheControl.fromString('public, max-age=31536000, immutable')],
      prune: false,
    });
    const shell = new s3deploy.BucketDeployment(this, 'DeployShell', {
      destinationBucket: bucket,
      sources: [s3deploy.Source.asset(distDir, { exclude: ['assets', 'assets/**'] })],
      cacheControl: [s3deploy.CacheControl.fromString('no-cache')],
      prune: false,
      distribution,
      distributionPaths: ['/index.html', '/sw.js', '/manifest.webmanifest', '/theme-init.js'],
    });
    shell.node.addDependency(assets); // new assets exist before the new index.html points to them

    new CfnOutput(this, 'SiteUrl', {
      value: `https://${props.domainName || distribution.distributionDomainName}`,
    });
    new CfnOutput(this, 'DistributionId', { value: distribution.distributionId });
    new CfnOutput(this, 'BucketName', { value: bucket.bucketName });
  }
}
