# Source of truth for the list of published @vendure/* packages.
# Sourced by npm-trust-bulk.sh and npm-stage-approve-all.sh.
#
# Keep alphabetical; remove a package only when it has been unpublished /
# deprecated, otherwise the trust + approval scripts will skip it.

VENDURE_PACKAGES=(
  "@vendure/admin-ui"
  "@vendure/admin-ui-plugin"
  "@vendure/asset-server-plugin"
  "@vendure/cli"
  "@vendure/common"
  "@vendure/core"
  "@vendure/create"
  "@vendure/dashboard"
  "@vendure/email-plugin"
  "@vendure/graphiql-plugin"
  "@vendure/harden-plugin"
  "@vendure/job-queue-plugin"
  "@vendure/telemetry-plugin"
  "@vendure/testing"
  "@vendure/ui-devkit"
)
