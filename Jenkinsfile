pipeline {
  agent any

  parameters {
    booleanParam(name: 'DEPLOY_TO_EC2', defaultValue: false, description: 'Deploy to EC2 after build?')
  }

  stages {
    stage('Install') {
      steps {
        powershell 'pnpm install --frozen-lockfile'
      }
    }

    stage('Prisma Generate') {
      steps {
        powershell 'pnpm prisma generate'
      }
    }

    stage('Test') {
      steps {
        powershell 'pnpm test'
      }
    }

    stage('Build') {
      steps {
        powershell 'pnpm run build'
      }
    }
  }
}