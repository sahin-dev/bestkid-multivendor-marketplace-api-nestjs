pipeline {
  agent any

  tools {
    nodejs 'node-24'
  }

  stages {
    stage('Verify Tools') {
      steps {
        powershell '''
          node -v
          npm -v
          pnpm -v
        '''
      }
    }

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