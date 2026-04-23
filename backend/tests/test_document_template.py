def test_template_category_enum():
    from app.models.document_template import TemplateCategory
    assert TemplateCategory.PRESCRIPTION == "prescription"
    assert TemplateCategory.DISCHARGE == "discharge"
    assert TemplateCategory.REFERRAL == "referral"
    assert TemplateCategory.CERTIFICATE == "certificate"
