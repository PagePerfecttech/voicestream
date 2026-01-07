#!/bin/bash

# Quick TypeScript Error Fix Script
echo "🔧 Fixing TypeScript compilation errors..."

# Fix express-validator imports in ai.ts
echo "Fixing ai.ts express-validator import..."
sed -i 's/import validator from '\''express-validator'\'';/import { body, param, query, validationResult } from '\''express-validator'\'';/' src/routes/ai.ts
sed -i '/const { body, param, query, validationResult } = validator;/d' src/routes/ai.ts

# Fix express-validator imports in monetization.ts
echo "Fixing monetization.ts express-validator import..."
sed -i 's/import validator from '\''express-validator'\'';/import { body, param, query, validationResult } from '\''express-validator'\'';/' src/routes/monetization.ts
sed -i '/const { body, param, query, validationResult } = validator;/d' src/routes/monetization.ts

# Fix missing return statements in analytics.ts
echo "Fixing analytics.ts missing return statements..."
sed -i 's/    res\.json(metrics);/    return res.json(metrics);/' src/routes/analytics.ts
sed -i 's/    res\.json(report);/    return res.json(report);/' src/routes/analytics.ts
sed -i 's/    res\.json(results);/    return res.json(results);/' src/routes/analytics.ts
sed -i 's/    res\.json({ success: true });/    return res.json({ success: true });/' src/routes/analytics.ts
sed -i 's/    res\.json({ /    return res.json({ /' src/routes/analytics.ts

# Fix missing return statements in channels.ts
echo "Fixing channels.ts missing return statements..."
sed -i 's/    res\.json({ success: true, data: channels });/    return res.json({ success: true, data: channels });/' src/routes/channels.ts
sed -i 's/    res\.json({ success: true, data: channel });/    return res.json({ success: true, data: channel });/' src/routes/channels.ts
sed -i 's/    res\.json({ /    return res.json({ /' src/routes/channels.ts

# Fix missing return statements in concurrent.ts
echo "Fixing concurrent.ts missing return statements..."
sed -i 's/    res\.status(202)\.json({/    return res.status(202).json({/' src/routes/concurrent.ts
sed -i 's/    res\.json(result);/    return res.json(result);/' src/routes/concurrent.ts
sed -i 's/    res\.json(constraints);/    return res.json(constraints);/' src/routes/concurrent.ts
sed -i 's/    res\.json({ available });/    return res.json({ available });/' src/routes/concurrent.ts
sed -i 's/    res\.status(500)\.json({ error: error\.message });/    return res.status(500).json({ error: error.message });/' src/routes/concurrent.ts
sed -i 's/    res\.status(404)\.json({ error: error\.message });/    return res.status(404).json({ error: error.message });/' src/routes/concurrent.ts

# Fix missing return statements in distribution.ts
echo "Fixing distribution.ts missing return statements..."
sed -i 's/    res\.json(/    return res.json(/' src/routes/distribution.ts
sed -i 's/    res\.status([0-9]*)\.json(/    return res.status(\1).json(/' src/routes/distribution.ts

# Fix missing return statements in interaction.ts
echo "Fixing interaction.ts missing return statements..."
sed -i 's/    res\.json(/    return res.json(/' src/routes/interaction.ts
sed -i 's/    res\.status([0-9]*)\.json(/    return res.status(\1).json(/' src/routes/interaction.ts

echo "✅ TypeScript error fixes applied!"
echo "🚀 Now running deployment..."

# Run the deployment
./scripts/deploy-neon.sh