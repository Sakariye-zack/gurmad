# 52. Production Release Checklist

## Before deployment
- [ ] Approved requirements
- [ ] Git commit/tag
- [ ] Database backup
- [ ] Migration reviewed
- [ ] Staging tests passed
- [ ] UAT approved
- [ ] Security checks passed
- [ ] Financial reconciliation completed
- [ ] Rollback plan ready

## Deployment
- [ ] Pull approved code
- [ ] Install/build
- [ ] Run approved migrations
- [ ] Restart PM2
- [ ] Verify Nginx
- [ ] Verify API health
- [ ] Verify frontend
- [ ] Verify database
- [ ] Verify payment integrations

## After deployment
- [ ] Test login
- [ ] Test customer
- [ ] Test collection
- [ ] Test payment
- [ ] Test cashout
- [ ] Test report
- [ ] Check logs
- [ ] Confirm monitoring
- [ ] Record release version

## Rollback
Use the last known-good application version and a tested database recovery/migration strategy if the release causes critical failure.
