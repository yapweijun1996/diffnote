<cfcomponent>
  <cffunction name="getCustomer" access="public" returntype="query">
    <cfargument name="custId" type="numeric" required="true">

    <!--- use cfqueryparam to prevent SQL injection --->
    <cfquery name="qCustomer" datasource="globe3">
      SELECT cust_id, cust_name, email, phone
      FROM customers
      WHERE cust_id = <cfqueryparam value="#arguments.custId#" cfsqltype="cf_sql_integer">
    </cfquery>

    <cfreturn qCustomer>
  </cffunction>

  <cffunction name="listActive" access="public" returntype="query">
    <cfargument name="branchId" type="numeric" required="false" default="0">
    <cfquery name="qList" datasource="globe3">
      SELECT cust_id, cust_name, email
      FROM customers
      WHERE status = 'A'
      <cfif arguments.branchId GT 0>
        AND branch_id = <cfqueryparam value="#arguments.branchId#" cfsqltype="cf_sql_integer">
      </cfif>
      ORDER BY cust_name
    </cfquery>
    <cfreturn qList>
  </cffunction>
</cfcomponent>
