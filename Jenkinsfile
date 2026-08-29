pipeline {
  agent any

  tools {
    nodejs 'node-24'
  }

  options {
    disableConcurrentBuilds(abortPrevious: false)
    timeout(time: 45, unit: 'MINUTES')
  }

  parameters {
    booleanParam(name: 'DEPLOY_TO_EC2', defaultValue: false, description: 'Deploy to EC2 after build?')
    string(name: 'EC2_HOST', defaultValue: '52.2.132.76', description: 'EC2 public IP or domain. Required only when DEPLOY_TO_EC2=true.')
    string(name: 'EC2_PORT', defaultValue: '22', description: 'SSH port for EC2.')
    string(name: 'DEPLOY_PATH', defaultValue: '/var/www/bestkid', description: 'Must match GitHub Actions DEPLOY_PATH.')
    string(name: 'PM2_APP_NAME', defaultValue: 'bestkid-api', description: 'Must match GitHub Actions PM2_APP_NAME.')
    booleanParam(name: 'RUN_MIGRATIONS', defaultValue: true, description: 'Run pnpm prisma migrate deploy on EC2.')
    string(name: 'HEALTHCHECK_URL', defaultValue: '', description: 'Optional production healthcheck URL.')
    string(name: 'SSH_CREDENTIAL_ID', defaultValue: 'bestkid-ec2-key', description: 'Jenkins SSH Username with private key credential ID.')
  }

  environment {
    DATABASE_URL = 'postgresql://ci:ci@localhost:5432/ci?schema=public'
    RELEASE_ARTIFACT = 'bestkid-release'
    PNPM_VERSION = '10'
  }

  stages {
    stage('Verify Tools') {
      steps {
        powershell '''
          $ErrorActionPreference = 'Stop'
          node -v
          npm -v
          pnpm -v
        '''
      }
    }

    stage('Install') {
      steps {
        powershell '''
          $ErrorActionPreference = 'Stop'
          pnpm install --frozen-lockfile
        '''
      }
    }

    stage('Prisma Generate') {
      steps {
        powershell '''
          $ErrorActionPreference = 'Stop'
          pnpm prisma generate
        '''
      }
    }

    stage('Test') {
      steps {
        powershell '''
          $ErrorActionPreference = 'Stop'
          pnpm exec jest --runInBand
        '''
      }
    }

    stage('Build') {
      steps {
        powershell '''
          $ErrorActionPreference = 'Stop'
          pnpm run build
        '''
      }
    }

    stage('Prepare Release Bundle') {
      steps {
        powershell '''
          $ErrorActionPreference = 'Stop'

          if (Test-Path -LiteralPath 'release') {
            Remove-Item -LiteralPath 'release' -Recurse -Force
          }

          if (Test-Path -LiteralPath 'release.tar.gz') {
            Remove-Item -LiteralPath 'release.tar.gz' -Force
          }

          New-Item -ItemType Directory -Path 'release' | Out-Null

          Copy-Item -LiteralPath 'dist' -Destination 'release\\dist' -Recurse
          Copy-Item -LiteralPath 'package.json' -Destination 'release\\package.json'
          Copy-Item -LiteralPath 'pnpm-lock.yaml' -Destination 'release\\pnpm-lock.yaml'
          Copy-Item -LiteralPath 'ecosystem.config.js' -Destination 'release\\ecosystem.config.js'
          Copy-Item -LiteralPath 'prisma.config.ts' -Destination 'release\\prisma.config.ts'
          Copy-Item -LiteralPath 'prisma' -Destination 'release\\prisma' -Recurse

          if (Test-Path -LiteralPath 'generated') {
            Copy-Item -LiteralPath 'generated' -Destination 'release\\generated' -Recurse
          }

          tar -czf release.tar.gz -C release .

          if (!(Test-Path -LiteralPath 'release.tar.gz')) {
            throw 'release.tar.gz was not created.'
          }
        '''
      }
    }

    stage('Deploy to EC2') {
      when {
        expression { return params.DEPLOY_TO_EC2 }
      }
      steps {
        withCredentials([
          sshUserPrivateKey(
            credentialsId: "${params.SSH_CREDENTIAL_ID}",
            keyFileVariable: 'SSH_KEY',
            usernameVariable: 'EC2_USER'
          )
        ]) {
          powershell '''
            $ErrorActionPreference = 'Stop'

            if ([string]::IsNullOrWhiteSpace($env:EC2_HOST)) {
              throw 'Missing EC2_HOST parameter.'
            }

            if ([string]::IsNullOrWhiteSpace($env:GIT_COMMIT)) {
              throw 'Missing GIT_COMMIT from Jenkins checkout.'
            }

            $releaseId = "$env:BUILD_NUMBER-$env:GIT_COMMIT"
            $remoteTarball = "/tmp/bestkid-$releaseId.tar.gz"
            $remoteTarget = "$($env:EC2_USER)@$($env:EC2_HOST):$remoteTarball"
            $safeBuildTag = $env:BUILD_TAG -replace '[^A-Za-z0-9_.-]', '-'
            $deployKey = Join-Path ([System.IO.Path]::GetTempPath()) "jenkins-deploy-key-$safeBuildTag"

            try {
            Copy-Item -LiteralPath "$env:SSH_KEY" -Destination "$deployKey" -Force
            $currentSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
            icacls.exe "$deployKey" /inheritance:r | Out-Null
            icacls.exe "$deployKey" /grant:r "*${currentSid}:R" | Out-Null

            scp -i "$deployKey" -P "$env:EC2_PORT" -o StrictHostKeyChecking=accept-new release.tar.gz "$remoteTarget"
            if ($LASTEXITCODE -ne 0) {
              throw "scp upload failed with exit code $LASTEXITCODE."
            }

            $remoteScript = @'
set -Eeuo pipefail

if [ -s "$HOME/.nvm/nvm.sh" ]; then
  . "$HOME/.nvm/nvm.sh"
  nvm use 24 >/dev/null 2>&1 || true
fi

export PNPM_HOME="${PNPM_HOME:-$HOME/.local/share/pnpm}"
export PATH="$PNPM_HOME:$HOME/.npm-global/bin:$HOME/.local/bin:$HOME/.nvm/versions/node/v24.19.0/bin:$PATH"

RELEASE_TARBALL="/tmp/bestkid-$RELEASE_ID.tar.gz"
RELEASE_DIR="$DEPLOY_PATH/releases/$RELEASE_ID"
SHARED_DIR="$DEPLOY_PATH/shared"
CURRENT_LINK="$DEPLOY_PATH/current"

DEPLOY_USER="$(id -un)"
DEPLOY_GROUP="$(id -gn)"

if [ ! -d "$DEPLOY_PATH" ] || [ ! -w "$DEPLOY_PATH" ]; then
  if sudo -n true >/dev/null 2>&1; then
    sudo mkdir -p "$DEPLOY_PATH/releases" "$SHARED_DIR/uploads" "$SHARED_DIR/logs"
    sudo chown -R "$DEPLOY_USER:$DEPLOY_GROUP" "$DEPLOY_PATH"
  else
    echo "Deploy user '$DEPLOY_USER' cannot write to $DEPLOY_PATH and passwordless sudo is unavailable."
    echo "Run on the EC2 server: sudo mkdir -p '$DEPLOY_PATH' && sudo chown -R '$DEPLOY_USER:$DEPLOY_GROUP' '$DEPLOY_PATH'"
    exit 1
  fi
fi

mkdir -p "$DEPLOY_PATH/releases" "$SHARED_DIR/uploads" "$SHARED_DIR/logs"

echo "Deploy host: $(hostname)"
echo "Deploy user: $DEPLOY_USER"
echo "Deploy path: $DEPLOY_PATH"
echo "Shared directory contents:"
ls -la "$SHARED_DIR"

if [ ! -f "$SHARED_DIR/.env" ]; then
  echo "Missing production env file: $SHARED_DIR/.env"
  exit 1
fi

mkdir -p "$RELEASE_DIR"
tar -xzf "$RELEASE_TARBALL" -C "$RELEASE_DIR"

ln -sfn "$SHARED_DIR/.env" "$RELEASE_DIR/.env"
rm -rf "$RELEASE_DIR/uploads" "$RELEASE_DIR/logs"
ln -sfn "$SHARED_DIR/uploads" "$RELEASE_DIR/uploads"
ln -sfn "$SHARED_DIR/logs" "$RELEASE_DIR/logs"

if [ -f "$SHARED_DIR/firebase-service-account.json" ]; then
  ln -sfn "$SHARED_DIR/firebase-service-account.json" "$RELEASE_DIR/firebase-service-account.json"
else
  echo "Warning: $SHARED_DIR/firebase-service-account.json not found; Firebase push notifications will stay disabled."
fi

cd "$RELEASE_DIR"

if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    corepack enable
    corepack prepare pnpm@10 --activate
  elif command -v npm >/dev/null 2>&1; then
    if ! npm install -g pnpm@10; then
      sudo -n npm install -g pnpm@10
    fi
  else
    echo "pnpm is not installed, and neither corepack nor npm is available on this server."
    echo "Install Node.js 24 and pnpm 10 on the EC2 server, then rerun this pipeline."
    exit 1
  fi
fi

pnpm install --frozen-lockfile
pnpm prisma generate

if [ "$RUN_MIGRATIONS" = "true" ]; then
  pnpm prisma migrate deploy
fi

pnpm prune --prod

echo "$RELEASE_ID" > "$RELEASE_DIR/.release"
ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"

cd "$CURRENT_LINK"
export PM2_CWD="$CURRENT_LINK"

if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
  pm2 reload ecosystem.config.js --only "$PM2_APP_NAME" --env production --update-env
else
  pm2 start ecosystem.config.js --only "$PM2_APP_NAME" --env production
fi

pm2 save

HEALTH_STATUS=0
if [ -n "$HEALTHCHECK_URL" ]; then
  curl --fail --silent --show-error --retry 5 --retry-delay 5 --retry-connrefused "$HEALTHCHECK_URL" >/dev/null || HEALTH_STATUS=$?
fi

cd "$DEPLOY_PATH/releases"
ls -1dt */ | tail -n +6 | xargs -r rm -rf
rm -f "$RELEASE_TARBALL"

exit "$HEALTH_STATUS"
'@

            Set-Content -LiteralPath 'remote-deploy.sh' -Value $remoteScript -NoNewline -Encoding UTF8

            $remoteCommand = "DEPLOY_PATH='$($env:DEPLOY_PATH)' RELEASE_ID='$releaseId' PM2_APP_NAME='$($env:PM2_APP_NAME)' RUN_MIGRATIONS='$($env:RUN_MIGRATIONS)' HEALTHCHECK_URL='$($env:HEALTHCHECK_URL)' bash -s"

            Get-Content -LiteralPath 'remote-deploy.sh' |
              ssh -i "$deployKey" -p "$env:EC2_PORT" -o StrictHostKeyChecking=accept-new "$($env:EC2_USER)@$($env:EC2_HOST)" "$remoteCommand"
            if ($LASTEXITCODE -ne 0) {
              throw "ssh deploy failed with exit code $LASTEXITCODE."
            }
            } finally {
              if (Test-Path -LiteralPath "$deployKey") {
                Remove-Item -LiteralPath "$deployKey" -Force
              }

              if (Test-Path -LiteralPath 'remote-deploy.sh') {
                Remove-Item -LiteralPath 'remote-deploy.sh' -Force
              }
            }
          '''
        }
      }
    }
  }

  post {
    always {
      archiveArtifacts artifacts: 'release.tar.gz', allowEmptyArchive: true, fingerprint: true
    }
  }
}
