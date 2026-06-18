# One-time Supabase CLI setup for this project
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$projectRef = "gzlbvdvocfgmnzzkvksd"

Write-Host "Project ref: $projectRef"
Write-Host ""
Write-Host "Step 1: Login (opens browser)"
supabase login

Write-Host ""
Write-Host "Step 2: Link project"
supabase link --project-ref $projectRef

Write-Host ""
Write-Host "Step 3: Push migrations"
supabase db push

Write-Host ""
Write-Host "Step 4: Deploy process-excel (optional)"
supabase functions deploy process-excel

Write-Host "Done."
